import os
import re
import threading
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile

from flask import Flask, jsonify, render_template, request
from openpyxl import load_workbook
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
    delete,
    func,
    select,
    case,
    or_,
)
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = BASE_DIR / "runtime_data"
RUNTIME_DIR.mkdir(exist_ok=True)
SEED_FILE = BASE_DIR / "data" / "pnr_seed.xlsx"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{RUNTIME_DIR / 'pnr.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine_kwargs = {"pool_pre_ping": True, "future": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)
Base = declarative_base()


class PNRRecord(Base):
    __tablename__ = "pnr_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    data = Column(Date, index=True, nullable=False)
    filial = Column(String(20), index=True)
    ticket_number = Column(String(80), index=True)
    order_source = Column(Text, index=True)
    base = Column(String(160), index=True)
    driver = Column(Text, index=True)
    rm = Column(String(180), index=True)
    supervisor = Column(String(180), index=True)
    station = Column(String(40), index=True)  # Própria / Franquia
    atendimento = Column(String(220), index=True)
    issue_l1 = Column(Text)
    issue_l2 = Column(Text)


class AppMeta(Base):
    __tablename__ = "app_meta"

    id = Column(Integer, primary_key=True, default=1)
    version = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    source_name = Column(String(255), nullable=True)
    row_count = Column(Integer, nullable=False, default=0)


Base.metadata.create_all(engine)
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 40 * 1024 * 1024
IMPORT_LOCK = threading.Lock()


def clean_text(value):
    if value is None:
        return ""
    value = str(value).strip()
    if value.lower() in {"none", "nan"}:
        return ""
    return value


def normalize_header(value):
    text = clean_text(value).lower()
    text = text.replace("º", "o")
    replacements = str.maketrans("áàãâäéèêëíìîïóòõôöúùûüç", "aaaaaeeeeiiiiooooouuuuc")
    text = text.translate(replacements)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_station(raw_value, base_value):
    raw = clean_text(raw_value).upper()
    base = clean_text(base_value).upper()
    if "FRANQUIA" in raw:
        return "Franquia"
    if "PROPRIA" in normalize_header(raw).upper():
        return "Própria"
    if base.startswith("F ") or base.startswith("F-"):
        return "Franquia"
    if base:
        return "Própria"
    return "Não informado"


def normalize_value(value, fallback="Não informado"):
    text = clean_text(value)
    if text in {"#N/A", "#REF!", "#VALUE!", "#NAME?"}:
        return fallback
    return text or fallback


def parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = clean_text(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


HEADER_ALIASES = {
    "data": {"data"},
    "filial": {"filial", "regional"},
    "ticket_number": {"numero do ticket", "ticket", "n do ticket"},
    "order_source": {"origem do pedido", "origem pedido"},
    "base": {"base", "estacao base"},
    "driver": {"motorista", "driver"},
    "rm": {"rm"},
    "supervisor": {"supervisor"},
    "station": {"estacao", "tipo de estacao"},
    "atendimento": {"atendimento"},
    "issue_l1": {"tipo de item problematico nivel 1"},
    "issue_l2": {"tipo de item problematico nivel 2"},
}

REQUIRED_KEYS = {"data", "base", "driver", "rm", "supervisor", "atendimento", "order_source"}


def resolve_columns(headers):
    normalized = {normalize_header(v): i for i, v in enumerate(headers) if clean_text(v)}
    resolved = {}
    for key, aliases in HEADER_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                resolved[key] = normalized[alias]
                break
    missing = sorted(REQUIRED_KEYS - set(resolved))
    if missing:
        raise ValueError("Colunas obrigatórias não encontradas: " + ", ".join(missing))
    return resolved


def parse_workbook(path):
    # data_only=True is intentional: the source workbook contains cached VLOOKUP results.
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    headers = next(rows, None)
    if not headers:
        raise ValueError("A planilha está vazia.")
    cols = resolve_columns(headers)

    parsed = []
    skipped = 0
    for row in rows:
        d = parse_date(row[cols["data"]] if cols.get("data") is not None else None)
        if not d:
            skipped += 1
            continue
        base_value = normalize_value(row[cols["base"]], "Sem base")
        station_raw = row[cols["station"]] if "station" in cols else ""
        item = {
            "data": d,
            "filial": normalize_value(row[cols["filial"]], "Não informado") if "filial" in cols else "Não informado",
            "ticket_number": normalize_value(row[cols["ticket_number"]], "") if "ticket_number" in cols else "",
            "order_source": normalize_value(row[cols["order_source"]]),
            "base": base_value,
            "driver": normalize_value(row[cols["driver"]]),
            "rm": normalize_value(row[cols["rm"]]),
            "supervisor": normalize_value(row[cols["supervisor"]]),
            "station": normalize_station(station_raw, base_value),
            "atendimento": normalize_value(row[cols["atendimento"]]),
            "issue_l1": normalize_value(row[cols["issue_l1"]], "") if "issue_l1" in cols else "",
            "issue_l2": normalize_value(row[cols["issue_l2"]], "") if "issue_l2" in cols else "",
        }
        parsed.append(item)
    wb.close()
    if not parsed:
        raise ValueError("Nenhum registro válido com data foi encontrado.")
    return parsed, skipped


def replace_records(records, source_name):
    with SessionLocal.begin() as session:
        session.execute(delete(PNRRecord))
        batch_size = 3000
        for start in range(0, len(records), batch_size):
            session.bulk_insert_mappings(PNRRecord, records[start:start + batch_size])
        meta = session.get(AppMeta, 1)
        if not meta:
            meta = AppMeta(id=1, version=1, updated_at=datetime.utcnow(), source_name=source_name, row_count=len(records))
            session.add(meta)
        else:
            meta.version += 1
            meta.updated_at = datetime.utcnow()
            meta.source_name = source_name
            meta.row_count = len(records)


def ensure_seed_data():
    with SessionLocal() as session:
        count = session.scalar(select(func.count()).select_from(PNRRecord)) or 0
        if count:
            meta = session.get(AppMeta, 1)
            if not meta:
                session.add(AppMeta(id=1, version=1, updated_at=datetime.utcnow(), source_name="Banco existente", row_count=count))
                session.commit()
            return
    if not SEED_FILE.exists():
        return
    with IMPORT_LOCK:
        with SessionLocal() as session:
            count = session.scalar(select(func.count()).select_from(PNRRecord)) or 0
            if count:
                return
        records, _ = parse_workbook(SEED_FILE)
        replace_records(records, SEED_FILE.name)


ensure_seed_data()


def build_conditions(args):
    cond = []
    start_date = parse_date(args.get("start_date"))
    end_date = parse_date(args.get("end_date"))
    if start_date:
        cond.append(PNRRecord.data >= start_date)
    if end_date:
        cond.append(PNRRecord.data <= end_date)

    mapping = {
        "regional": PNRRecord.filial,
        "supervisor": PNRRecord.supervisor,
        "rm": PNRRecord.rm,
        "station": PNRRecord.station,
        "base": PNRRecord.base,
        "atendimento": PNRRecord.atendimento,
    }
    for arg_name, column in mapping.items():
        value = clean_text(args.get(arg_name))
        if value and value != "__all__":
            cond.append(column == value)
    return cond


def grouped_counts(session, column, conditions, limit=None):
    stmt = (
        select(column, func.count(PNRRecord.id).label("count"))
        .where(*conditions)
        .group_by(column)
        .order_by(func.count(PNRRecord.id).desc(), column.asc())
    )
    if limit:
        stmt = stmt.limit(limit)
    result = []
    for label, count in session.execute(stmt):
        label = label or "Não informado"
        result.append({"label": label, "count": int(count)})
    return result


def distinct_values(session, column):
    stmt = select(column).distinct().where(column.is_not(None)).order_by(column.asc())
    values = [v for (v,) in session.execute(stmt) if clean_text(v)]
    return values


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    try:
        with SessionLocal() as session:
            session.execute(select(1))
        return jsonify({"status": "ok"})
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.get("/api/version")
def version():
    with SessionLocal() as session:
        meta = session.get(AppMeta, 1)
        return jsonify({
            "version": meta.version if meta else 0,
            "updated_at": meta.updated_at.isoformat() + "Z" if meta and meta.updated_at else None,
            "source_name": meta.source_name if meta else None,
            "row_count": meta.row_count if meta else 0,
        })


@app.get("/api/filters")
def filters():
    with SessionLocal() as session:
        min_date, max_date = session.execute(select(func.min(PNRRecord.data), func.max(PNRRecord.data))).one()
        meta = session.get(AppMeta, 1)
        payload = {
            "date_min": min_date.isoformat() if min_date else None,
            "date_max": max_date.isoformat() if max_date else None,
            "regional": distinct_values(session, PNRRecord.filial),
            "supervisor": distinct_values(session, PNRRecord.supervisor),
            "rm": distinct_values(session, PNRRecord.rm),
            "station": distinct_values(session, PNRRecord.station),
            "base": distinct_values(session, PNRRecord.base),
            "atendimento": distinct_values(session, PNRRecord.atendimento),
            "version": meta.version if meta else 0,
        }
        return jsonify(payload)


@app.get("/api/dashboard")
def dashboard_data():
    conditions = build_conditions(request.args)
    with SessionLocal() as session:
        total = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions)) or 0)
        own = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.station == "Própria")) or 0)
        franchise = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.station == "Franquia")) or 0)
        bases_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.base))).where(*conditions)) or 0)
        rms_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.rm))).where(*conditions)) or 0)
        drivers_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.driver))).where(*conditions)) or 0)

        rm_rows = []
        rm_stmt = (
            select(
                PNRRecord.rm,
                func.count(PNRRecord.id).label("total"),
                func.sum(case((PNRRecord.station == "Própria", 1), else_=0)).label("own"),
                func.sum(case((PNRRecord.station == "Franquia", 1), else_=0)).label("franchise"),
            )
            .where(*conditions)
            .group_by(PNRRecord.rm)
            .order_by(func.count(PNRRecord.id).desc())
        )
        # func.case is not portable in every SQLAlchemy version; fall back below if needed.
        try:
            raw_rm = session.execute(rm_stmt).all()
            for rm, cnt, own_cnt, fran_cnt in raw_rm:
                rm_rows.append({
                    "rm": rm or "Não informado",
                    "count": int(cnt or 0),
                    "own": int(own_cnt or 0),
                    "franchise": int(fran_cnt or 0),
                    "share": round((int(cnt or 0) / total * 100), 1) if total else 0,
                })
        except Exception:
            session.rollback()
            grouped = grouped_counts(session, PNRRecord.rm, conditions)
            for item in grouped:
                rm_val = item["label"]
                own_cnt = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.rm == rm_val, PNRRecord.station == "Própria")) or 0)
                fran_cnt = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.rm == rm_val, PNRRecord.station == "Franquia")) or 0)
                rm_rows.append({"rm": rm_val, "count": item["count"], "own": own_cnt, "franchise": fran_cnt, "share": round(item["count"] / total * 100, 1) if total else 0})

        station_rows = []
        for station_name in ("Própria", "Franquia"):
            station_conditions = conditions + [PNRRecord.station == station_name]
            cnt = int(session.scalar(select(func.count(PNRRecord.id)).where(*station_conditions)) or 0)
            base_cnt = int(session.scalar(select(func.count(func.distinct(PNRRecord.base))).where(*station_conditions)) or 0)
            top = grouped_counts(session, PNRRecord.base, station_conditions, 1)
            station_rows.append({
                "station": station_name,
                "count": cnt,
                "share": round(cnt / total * 100, 1) if total else 0,
                "bases": base_cnt,
                "top_base": top[0]["label"] if top else "—",
            })

        top_bases = grouped_counts(session, PNRRecord.base, conditions, 10)
        top_drivers = grouped_counts(session, PNRRecord.driver, conditions, 10)
        top_origins = grouped_counts(session, PNRRecord.order_source, conditions, 10)

        daily_stmt = (
            select(PNRRecord.data, func.count(PNRRecord.id))
            .where(*conditions)
            .group_by(PNRRecord.data)
            .order_by(PNRRecord.data.asc())
        )
        daily = [{"date": d.isoformat(), "count": int(c)} for d, c in session.execute(daily_stmt)]

        return jsonify({
            "kpis": {
                "total": total,
                "own": own,
                "franchise": franchise,
                "bases": bases_count,
                "rms": rms_count,
                "drivers": drivers_count,
            },
            "rm_ranking": rm_rows,
            "station_summary": station_rows,
            "top_bases": top_bases,
            "top_drivers": top_drivers,
            "top_origins": top_origins,
            "daily": daily,
        })


@app.post("/api/upload")
def upload_data():
    configured_key = os.getenv("ADMIN_KEY", "").strip()
    if configured_key:
        provided = request.headers.get("X-Admin-Key", "").strip() or request.form.get("admin_key", "").strip()
        if provided != configured_key:
            return jsonify({"ok": False, "message": "Chave de atualização inválida."}), 401

    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"ok": False, "message": "Selecione um arquivo .xlsx."}), 400
    if not uploaded.filename.lower().endswith(".xlsx"):
        return jsonify({"ok": False, "message": "Formato não suportado. Envie um arquivo .xlsx."}), 400

    with IMPORT_LOCK:
        temp_path = None
        try:
            with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
                uploaded.save(tmp.name)
                temp_path = tmp.name
            records, skipped = parse_workbook(temp_path)
            replace_records(records, uploaded.filename)
            with SessionLocal() as session:
                meta = session.get(AppMeta, 1)
            return jsonify({
                "ok": True,
                "message": "Base atualizada com sucesso.",
                "rows": len(records),
                "skipped": skipped,
                "version": meta.version if meta else None,
            })
        except ValueError as exc:
            return jsonify({"ok": False, "message": str(exc)}), 400
        except Exception as exc:
            app.logger.exception("Falha ao importar planilha")
            return jsonify({"ok": False, "message": f"Erro ao importar: {exc}"}), 500
        finally:
            if temp_path:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass


def _provided_admin_key(payload=None):
    payload = payload or {}
    return (
        request.headers.get("X-Admin-Key", "").strip()
        or clean_text(payload.get("admin_key"))
        or request.form.get("admin_key", "").strip()
        or request.args.get("admin_key", "").strip()
    )


def require_admin(payload=None):
    configured_key = os.getenv("ADMIN_KEY", "").strip()
    if not configured_key:
        return None
    if _provided_admin_key(payload) != configured_key:
        return jsonify({"ok": False, "message": "Chave de edição inválida."}), 401
    return None


def bump_meta(session, source_name="Edição pelo dashboard"):
    meta = session.get(AppMeta, 1)
    row_count = int(session.scalar(select(func.count()).select_from(PNRRecord)) or 0)
    if not meta:
        meta = AppMeta(
            id=1,
            version=1,
            updated_at=datetime.utcnow(),
            source_name=source_name,
            row_count=row_count,
        )
        session.add(meta)
    else:
        meta.version += 1
        meta.updated_at = datetime.utcnow()
        meta.source_name = source_name
        meta.row_count = row_count
    session.flush()
    return meta


def build_editor_conditions(args):
    cond = build_conditions(args)
    query = clean_text(args.get("q"))
    if query:
        token = f"%{query}%"
        cond.append(or_(
            PNRRecord.ticket_number.ilike(token),
            PNRRecord.order_source.ilike(token),
            PNRRecord.base.ilike(token),
            PNRRecord.driver.ilike(token),
            PNRRecord.rm.ilike(token),
            PNRRecord.supervisor.ilike(token),
            PNRRecord.atendimento.ilike(token),
            PNRRecord.filial.ilike(token),
            PNRRecord.issue_l1.ilike(token),
            PNRRecord.issue_l2.ilike(token),
        ))
    return cond


def record_payload(row):
    return {
        "id": row.id,
        "data": row.data.isoformat() if row.data else "",
        "filial": row.filial or "",
        "ticket_number": row.ticket_number or "",
        "order_source": row.order_source or "",
        "base": row.base or "",
        "driver": row.driver or "",
        "rm": row.rm or "",
        "supervisor": row.supervisor or "",
        "station": row.station or "",
        "atendimento": row.atendimento or "",
        "issue_l1": row.issue_l1 or "",
        "issue_l2": row.issue_l2 or "",
    }


def apply_record_values(row, values):
    parsed_date = parse_date(values.get("data"))
    if not parsed_date:
        raise ValueError("A data é obrigatória e deve ser válida.")

    base_value = normalize_value(values.get("base"), "Sem base")
    station_value = clean_text(values.get("station"))
    if station_value not in {"Própria", "Franquia", "Não informado"}:
        station_value = normalize_station(station_value, base_value)

    row.data = parsed_date
    row.filial = normalize_value(values.get("filial"))
    row.ticket_number = clean_text(values.get("ticket_number"))
    row.order_source = normalize_value(values.get("order_source"))
    row.base = base_value
    row.driver = normalize_value(values.get("driver"))
    row.rm = normalize_value(values.get("rm"))
    row.supervisor = normalize_value(values.get("supervisor"))
    row.station = station_value
    row.atendimento = normalize_value(values.get("atendimento"))
    row.issue_l1 = clean_text(values.get("issue_l1"))
    row.issue_l2 = clean_text(values.get("issue_l2"))


@app.get("/api/editor/rows")
def editor_rows():
    try:
        page = max(1, int(request.args.get("page", 1)))
        page_size = min(100, max(10, int(request.args.get("page_size", 25))))
    except ValueError:
        page, page_size = 1, 25

    conditions = build_editor_conditions(request.args)
    with SessionLocal() as session:
        total = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions)) or 0)
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        stmt = (
            select(PNRRecord)
            .where(*conditions)
            .order_by(PNRRecord.data.desc(), PNRRecord.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = [record_payload(row) for row in session.scalars(stmt)]
        return jsonify({
            "rows": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        })


@app.post("/api/editor/save")
def editor_save():
    payload = request.get_json(silent=True) or {}
    denied = require_admin(payload)
    if denied:
        return denied

    rows = payload.get("rows") or []
    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "message": "Nenhuma alteração para salvar."}), 400
    if len(rows) > 200:
        return jsonify({"ok": False, "message": "Salve no máximo 200 linhas por vez."}), 400

    saved = 0
    created = 0
    with IMPORT_LOCK:
        try:
            with SessionLocal.begin() as session:
                for values in rows:
                    row_id = values.get("id")
                    if row_id in (None, "", "new") or str(row_id).startswith("new-"):
                        row = PNRRecord()
                        session.add(row)
                        created += 1
                    else:
                        try:
                            row = session.get(PNRRecord, int(row_id))
                        except (TypeError, ValueError):
                            row = None
                        if not row:
                            raise ValueError(f"Registro {row_id} não encontrado.")
                    apply_record_values(row, values)
                    saved += 1
                session.flush()
                meta = bump_meta(session, "Edição manual no dashboard")
            return jsonify({
                "ok": True,
                "saved": saved,
                "created": created,
                "version": meta.version,
                "row_count": meta.row_count,
                "message": f"{saved} linha(s) salva(s).",
            })
        except ValueError as exc:
            return jsonify({"ok": False, "message": str(exc)}), 400
        except Exception as exc:
            app.logger.exception("Falha ao salvar edição")
            return jsonify({"ok": False, "message": f"Erro ao salvar: {exc}"}), 500


@app.delete("/api/editor/rows/<int:row_id>")
def editor_delete(row_id):
    payload = request.get_json(silent=True) or {}
    denied = require_admin(payload)
    if denied:
        return denied

    with IMPORT_LOCK:
        with SessionLocal.begin() as session:
            row = session.get(PNRRecord, row_id)
            if not row:
                return jsonify({"ok": False, "message": "Registro não encontrado."}), 404
            session.delete(row)
            session.flush()
            meta = bump_meta(session, "Exclusão manual no dashboard")
        return jsonify({
            "ok": True,
            "version": meta.version,
            "row_count": meta.row_count,
            "message": "Registro excluído.",
        })


@app.errorhandler(413)
def too_large(_):
    return jsonify({"ok": False, "message": "Arquivo muito grande. Limite de 40 MB."}), 413


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
