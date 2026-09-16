import json
import math
import os
import re
import threading
import unicodedata
from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from flask import Flask, jsonify, render_template, request, send_file
from openpyxl import Workbook, load_workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    case,
    create_engine,
    delete,
    func,
    or_,
    select,
)
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = BASE_DIR / "runtime_data"
RUNTIME_DIR.mkdir(exist_ok=True)
PNR_SEED_FILE = BASE_DIR / "data" / "pnr_seed.xlsx"
DELIVERY_SEED_FILE = BASE_DIR / "data" / "entregas_seed.xlsx"

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
    __tablename__ = "pnr_records_v3"

    id = Column(Integer, primary_key=True, autoincrement=True)
    data = Column(Date, index=True, nullable=False)
    filial = Column(String(30), index=True)
    ticket_number = Column(String(120), index=True)
    order_source = Column(Text, index=True)
    base = Column(String(180), index=True)
    driver = Column(Text, index=True)
    rm = Column(String(180), index=True)
    rm_key = Column(String(180), index=True)
    supervisor = Column(String(180), index=True)
    station = Column(String(40), index=True)
    atendimento = Column(String(220), index=True)
    issue_l1 = Column(Text)
    issue_l2 = Column(Text)
    merchandise_value = Column(Float, nullable=False, default=0)
    raw_json = Column(Text)


class DeliveryRecord(Base):
    __tablename__ = "delivery_records_v3"

    id = Column(Integer, primary_key=True, autoincrement=True)
    data = Column(Date, index=True, nullable=False)
    filial = Column(String(30), index=True)
    rm = Column(String(180), index=True)
    rm_key = Column(String(180), index=True)
    base = Column(String(180), index=True)
    delivered_qty = Column(Float, nullable=False, default=0)


class AppMeta(Base):
    __tablename__ = "app_meta_v3"

    id = Column(Integer, primary_key=True, default=1)
    version = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    pnr_source_name = Column(String(255), nullable=True)
    delivery_source_name = Column(String(255), nullable=True)
    pnr_row_count = Column(Integer, nullable=False, default=0)
    delivery_row_count = Column(Integer, nullable=False, default=0)
    pnr_headers_json = Column(Text, nullable=True)


Base.metadata.create_all(engine)
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 80 * 1024 * 1024
IMPORT_LOCK = threading.Lock()
EDIT_PASSWORD = "3264542"
RAW_EXPORT_PAGE_SIZE = 100_000


def clean_text(value):
    if value is None:
        return ""
    value = str(value).strip()
    if value.lower() in {"none", "nan"}:
        return ""
    return value


def normalize_header(value):
    text = clean_text(value).lower().replace("º", "o")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def join_key(value):
    text = normalize_header(value)
    if text in {"", "#n/a", "#ref!", "#value!", "#name?", "nao informado"}:
        return ""
    return text


def normalize_station(raw_value, base_value):
    raw = normalize_header(raw_value)
    base = clean_text(base_value).upper()
    if "franquia" in raw:
        return "Franquia"
    if "propria" in raw:
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
    for fmt in (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def parse_number(value, default=0.0):
    if value is None or value == "":
        return default
    if isinstance(value, (int, float)):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default
    text = clean_text(value).replace("R$", "").replace(" ", "")
    if not text:
        return default
    try:
        if "," in text and "." in text:
            if text.rfind(",") > text.rfind("."):
                text = text.replace(".", "").replace(",", ".")
            else:
                text = text.replace(",", "")
        elif "," in text:
            text = text.replace(".", "").replace(",", ".")
        return float(text)
    except ValueError:
        return default


def json_safe_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat(sep=" ") if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


PNR_HEADER_ALIASES = {
    # Mantém o rótulo visual como Data, mas usa Hora de Envio quando ela existir.
    "data": ("hora de envio", "data"),
    "filial": ("filial", "regional"),
    "ticket_number": ("numero do ticket", "ticket", "n do ticket"),
    "order_source": ("origem do pedido", "origem pedido"),
    "base": ("base", "estacao base"),
    "driver": ("motorista", "driver"),
    "rm": ("rm",),
    "supervisor": ("supervisor",),
    "station": ("estacao", "tipo de estacao"),
    "atendimento": ("atendimento",),
    "issue_l1": ("tipo de item problematico nivel 1",),
    "issue_l2": ("tipo de item problematico nivel 2",),
    "merchandise_value": ("valor da mercadoria", "valor mercadoria"),
}
PNR_REQUIRED_KEYS = {"data", "base", "driver", "rm", "supervisor", "atendimento", "order_source"}

DELIVERY_HEADER_ALIASES = {
    "data": ("data",),
    "filial": ("filial", "nome da regional", "regional"),
    "rm": ("rm",),
    "base": ("nome da base", "base"),
    "delivered_qty": ("quantidade entregue com assinatura",),
}
DELIVERY_REQUIRED_KEYS = {"data", "filial", "rm", "base", "delivered_qty"}


def resolve_columns(headers, aliases, required):
    normalized = {normalize_header(v): i for i, v in enumerate(headers) if clean_text(v)}
    resolved = {}
    for key, variants in aliases.items():
        for alias in variants:
            if alias in normalized:
                resolved[key] = normalized[alias]
                break
    missing = sorted(required - set(resolved))
    if missing:
        raise ValueError("Colunas obrigatórias não encontradas: " + ", ".join(missing))
    return resolved


def parse_pnr_workbook(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header_row = next(rows, None)
    if not header_row:
        wb.close()
        raise ValueError("A planilha PNR BI está vazia.")
    headers = [clean_text(v) or f"Coluna {i + 1}" for i, v in enumerate(header_row)]
    cols = resolve_columns(headers, PNR_HEADER_ALIASES, PNR_REQUIRED_KEYS)

    parsed = []
    skipped = 0
    for row in rows:
        d = parse_date(row[cols["data"]] if cols.get("data") is not None else None)
        if not d:
            skipped += 1
            continue
        base_value = normalize_value(row[cols["base"]], "Sem base")
        rm_value = normalize_value(row[cols["rm"]])
        station_raw = row[cols["station"]] if "station" in cols else ""
        merchandise = parse_number(row[cols["merchandise_value"]]) if "merchandise_value" in cols else 0.0
        raw_values = [json_safe_value(v) for v in row[: len(headers)]]
        if len(raw_values) < len(headers):
            raw_values.extend([None] * (len(headers) - len(raw_values)))
        parsed.append({
            "data": d,
            "filial": normalize_value(row[cols["filial"]], "Não informado") if "filial" in cols else "Não informado",
            "ticket_number": normalize_value(row[cols["ticket_number"]], "") if "ticket_number" in cols else "",
            "order_source": normalize_value(row[cols["order_source"]]),
            "base": base_value,
            "driver": normalize_value(row[cols["driver"]]),
            "rm": rm_value,
            "rm_key": join_key(rm_value),
            "supervisor": normalize_value(row[cols["supervisor"]]),
            "station": normalize_station(station_raw, base_value),
            "atendimento": normalize_value(row[cols["atendimento"]]),
            "issue_l1": normalize_value(row[cols["issue_l1"]], "") if "issue_l1" in cols else "",
            "issue_l2": normalize_value(row[cols["issue_l2"]], "") if "issue_l2" in cols else "",
            "merchandise_value": merchandise,
            "raw_json": json.dumps(raw_values, ensure_ascii=False),
        })
    wb.close()
    if not parsed:
        raise ValueError("Nenhum registro válido com data foi encontrado na PNR BI.")
    return parsed, skipped, headers


def parse_delivery_workbook(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header_row = next(rows, None)
    if not header_row:
        wb.close()
        raise ValueError("A planilha Entregas BI está vazia.")
    headers = [clean_text(v) or f"Coluna {i + 1}" for i, v in enumerate(header_row)]
    cols = resolve_columns(headers, DELIVERY_HEADER_ALIASES, DELIVERY_REQUIRED_KEYS)

    parsed = []
    skipped = 0
    for row in rows:
        d = parse_date(row[cols["data"]])
        if not d:
            skipped += 1
            continue
        rm_value = normalize_value(row[cols["rm"]])
        parsed.append({
            "data": d,
            "filial": normalize_value(row[cols["filial"]]),
            "rm": rm_value,
            "rm_key": join_key(rm_value),
            "base": normalize_value(row[cols["base"]], "") if "base" in cols else "",
            "delivered_qty": parse_number(row[cols["delivered_qty"]]),
        })
    wb.close()
    if not parsed:
        raise ValueError("Nenhum registro válido com data foi encontrado na Entregas BI.")
    return parsed, skipped


def replace_all_data(pnr_records, delivery_records, pnr_source, delivery_source, pnr_headers):
    with SessionLocal.begin() as session:
        session.execute(delete(PNRRecord))
        session.execute(delete(DeliveryRecord))
        for start in range(0, len(pnr_records), 2500):
            session.bulk_insert_mappings(PNRRecord, pnr_records[start:start + 2500])
        for start in range(0, len(delivery_records), 2500):
            session.bulk_insert_mappings(DeliveryRecord, delivery_records[start:start + 2500])

        meta = session.get(AppMeta, 1)
        if not meta:
            meta = AppMeta(id=1, version=1)
            session.add(meta)
        else:
            meta.version += 1
        meta.updated_at = datetime.utcnow()
        meta.pnr_source_name = pnr_source
        meta.delivery_source_name = delivery_source
        meta.pnr_row_count = len(pnr_records)
        meta.delivery_row_count = len(delivery_records)
        meta.pnr_headers_json = json.dumps(pnr_headers, ensure_ascii=False)


def ensure_seed_data():
    with SessionLocal() as session:
        pnr_count = session.scalar(select(func.count()).select_from(PNRRecord)) or 0
        delivery_count = session.scalar(select(func.count()).select_from(DeliveryRecord)) or 0
        if pnr_count and delivery_count:
            meta = session.get(AppMeta, 1)
            if not meta:
                session.add(AppMeta(
                    id=1,
                    version=1,
                    updated_at=datetime.utcnow(),
                    pnr_source_name="Banco existente",
                    delivery_source_name="Banco existente",
                    pnr_row_count=pnr_count,
                    delivery_row_count=delivery_count,
                    pnr_headers_json="[]",
                ))
                session.commit()
            return
    if not PNR_SEED_FILE.exists() or not DELIVERY_SEED_FILE.exists():
        return
    with IMPORT_LOCK:
        with SessionLocal() as session:
            pnr_count = session.scalar(select(func.count()).select_from(PNRRecord)) or 0
            delivery_count = session.scalar(select(func.count()).select_from(DeliveryRecord)) or 0
            if pnr_count and delivery_count:
                return
        pnr_records, _, headers = parse_pnr_workbook(PNR_SEED_FILE)
        delivery_records, _ = parse_delivery_workbook(DELIVERY_SEED_FILE)
        replace_all_data(pnr_records, delivery_records, PNR_SEED_FILE.name, DELIVERY_SEED_FILE.name, headers)


ensure_seed_data()


def build_pnr_conditions(args, include_dates=True):
    cond = []
    if include_dates:
        start_date = parse_date(args.get("start_date"))
        end_date = parse_date(args.get("end_date"))
        if start_date:
            cond.append(PNRRecord.data >= start_date)
        if end_date:
            cond.append(PNRRecord.data <= end_date)

    mapping = {
        "regional": PNRRecord.filial,
        "supervisor": PNRRecord.supervisor,
        "station": PNRRecord.station,
        "base": PNRRecord.base,
        "atendimento": PNRRecord.atendimento,
        "driver": PNRRecord.driver,
        "order_source": PNRRecord.order_source,
    }
    for arg_name, column in mapping.items():
        value = clean_text(args.get(arg_name))
        if value and value != "__all__":
            cond.append(column == value)

    rm_value = clean_text(args.get("rm"))
    if rm_value and rm_value != "__all__":
        cond.append(PNRRecord.rm_key == join_key(rm_value))

    if clean_text(args.get("has_base")) == "1":
        cond.extend([PNRRecord.base.is_not(None), func.trim(PNRRecord.base) != "", PNRRecord.base != "Não informado"])
    if clean_text(args.get("has_driver")) == "1":
        cond.extend([PNRRecord.driver.is_not(None), func.trim(PNRRecord.driver) != "", PNRRecord.driver != "Não informado"])
    return cond


def build_delivery_conditions(args, include_dates=True, rm_key_value=None):
    cond = []
    if include_dates:
        start_date = parse_date(args.get("start_date"))
        end_date = parse_date(args.get("end_date"))
        if start_date:
            cond.append(DeliveryRecord.data >= start_date)
        if end_date:
            cond.append(DeliveryRecord.data <= end_date)
    regional = clean_text(args.get("regional"))
    if regional and regional != "__all__":
        cond.append(DeliveryRecord.filial == regional)
    if rm_key_value is None:
        rm_value = clean_text(args.get("rm"))
        if rm_value and rm_value != "__all__":
            rm_key_value = join_key(rm_value)
    if rm_key_value is not None and rm_key_value != "":
        cond.append(DeliveryRecord.rm_key == rm_key_value)
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
    return [{"label": label or "Não informado", "count": int(count)} for label, count in session.execute(stmt)]


def distinct_values(session, column):
    stmt = select(column).distinct().where(column.is_not(None)).order_by(column.asc())
    return [v for (v,) in session.execute(stmt) if clean_text(v)]


def safe_rate(complaints, deliveries):
    deliveries = float(deliveries or 0)
    if deliveries <= 0:
        return None
    return round(float(complaints or 0) / deliveries * 10000, 2)


def compute_rm_ranking(session, args, period_conditions):
    ref_date = parse_date(args.get("end_date"))
    if not ref_date:
        ref_date = session.scalar(select(func.max(PNRRecord.data)).where(*period_conditions))
    previous_date = ref_date - timedelta(days=1) if ref_date else None
    non_date_conditions = build_pnr_conditions(args, include_dates=False)

    stmt = (
        select(
            PNRRecord.rm_key,
            func.min(PNRRecord.rm).label("rm"),
            func.count(PNRRecord.id).label("total"),
            func.sum(case((PNRRecord.station == "Própria", 1), else_=0)).label("own"),
            func.sum(case((PNRRecord.station == "Franquia", 1), else_=0)).label("franchise"),
            func.sum(PNRRecord.merchandise_value).label("merchandise_value"),
        )
        .where(*period_conditions)
        .group_by(PNRRecord.rm_key)
    )

    rows = []
    for rm_key_value, rm, cnt, own_cnt, fran_cnt, value_total in session.execute(stmt):
        rm_key_value = rm_key_value or ""
        current_complaints = 0
        previous_complaints = 0
        current_deliveries = 0.0
        previous_deliveries = 0.0
        if ref_date:
            current_complaints = int(session.scalar(
                select(func.count(PNRRecord.id)).where(*non_date_conditions, PNRRecord.rm_key == rm_key_value, PNRRecord.data == ref_date)
            ) or 0)
            current_deliveries = float(session.scalar(
                select(func.sum(DeliveryRecord.delivered_qty)).where(
                    *build_delivery_conditions(args, include_dates=False, rm_key_value=rm_key_value),
                    DeliveryRecord.data == ref_date,
                )
            ) or 0)
        if previous_date:
            previous_complaints = int(session.scalar(
                select(func.count(PNRRecord.id)).where(*non_date_conditions, PNRRecord.rm_key == rm_key_value, PNRRecord.data == previous_date)
            ) or 0)
            previous_deliveries = float(session.scalar(
                select(func.sum(DeliveryRecord.delivered_qty)).where(
                    *build_delivery_conditions(args, include_dates=False, rm_key_value=rm_key_value),
                    DeliveryRecord.data == previous_date,
                )
            ) or 0)
        current_rate = safe_rate(current_complaints, current_deliveries)
        previous_rate = safe_rate(previous_complaints, previous_deliveries)
        variation = round(current_rate - previous_rate, 2) if current_rate is not None and previous_rate is not None else None
        rows.append({
            "rm": rm or "Não informado",
            "rm_key": rm_key_value,
            "count": int(cnt or 0),
            "own": int(own_cnt or 0),
            "franchise": int(fran_cnt or 0),
            "merchandise_value": round(float(value_total or 0), 2),
            "rate": current_rate,
            "previous_rate": previous_rate,
            "variation": variation,
            "current_complaints": current_complaints,
            "current_deliveries": round(current_deliveries, 2),
            "previous_complaints": previous_complaints,
            "previous_deliveries": round(previous_deliveries, 2),
        })
    rows.sort(key=lambda r: (r["rate"] is not None, r["rate"] if r["rate"] is not None else -1, r["count"]), reverse=True)
    return rows, ref_date, previous_date



def compute_base_ranking(session, args, period_conditions):
    """Ranking equivalente ao de RM, mas usando Base/Franquia como unidade de análise."""
    ref_date = parse_date(args.get("end_date"))
    if not ref_date:
        ref_date = session.scalar(select(func.max(PNRRecord.data)).where(*period_conditions))
    previous_date = ref_date - timedelta(days=1) if ref_date else None
    non_date_conditions = build_pnr_conditions(args, include_dates=False)

    stmt = (
        select(
            PNRRecord.base,
            func.min(PNRRecord.station).label("station"),
            func.count(PNRRecord.id).label("total"),
            func.sum(PNRRecord.merchandise_value).label("merchandise_value"),
        )
        .where(*period_conditions)
        .group_by(PNRRecord.base)
    )

    def complaint_totals(day_value):
        if not day_value:
            return {}
        rows = session.execute(
            select(PNRRecord.base, func.count(PNRRecord.id))
            .where(*non_date_conditions, PNRRecord.data == day_value)
            .group_by(PNRRecord.base)
        )
        out = {}
        for base_name, count in rows:
            key = join_key(base_name)
            out[key] = out.get(key, 0) + int(count or 0)
        return out

    def delivery_totals(day_value):
        if not day_value:
            return {}
        rows = session.execute(
            select(DeliveryRecord.base, func.sum(DeliveryRecord.delivered_qty))
            .where(*build_delivery_conditions(args, include_dates=False), DeliveryRecord.data == day_value)
            .group_by(DeliveryRecord.base)
        )
        out = {}
        for base_name, qty in rows:
            key = join_key(base_name)
            if not key:
                continue
            out[key] = out.get(key, 0.0) + float(qty or 0)
        return out

    current_complaints = complaint_totals(ref_date)
    previous_complaints = complaint_totals(previous_date)
    current_deliveries = delivery_totals(ref_date)
    previous_deliveries = delivery_totals(previous_date)

    rows = []
    for base_name, station, cnt, value_total in session.execute(stmt):
        display_base = base_name or "Não informado"
        key = join_key(display_base)
        cur_c = current_complaints.get(key, 0)
        prev_c = previous_complaints.get(key, 0)
        cur_d = current_deliveries.get(key, 0.0)
        prev_d = previous_deliveries.get(key, 0.0)
        current_rate = safe_rate(cur_c, cur_d)
        previous_rate = safe_rate(prev_c, prev_d)
        variation = round(current_rate - previous_rate, 2) if current_rate is not None and previous_rate is not None else None
        rows.append({
            "base": display_base,
            "base_key": key,
            "station": station or normalize_station("", display_base),
            "count": int(cnt or 0),
            "merchandise_value": round(float(value_total or 0), 2),
            "rate": current_rate,
            "previous_rate": previous_rate,
            "variation": variation,
            "current_complaints": cur_c,
            "current_deliveries": round(cur_d, 2),
            "previous_complaints": prev_c,
            "previous_deliveries": round(prev_d, 2),
        })
    rows.sort(key=lambda r: (r["rate"] is not None, r["rate"] if r["rate"] is not None else -1, r["count"]), reverse=True)
    return rows, ref_date, previous_date


def compute_base_dashboard(session, args):
    conditions = build_pnr_conditions(args)
    total = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions)) or 0)
    own = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.station == "Própria")) or 0)
    franchise = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.station == "Franquia")) or 0)
    bases_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.base))).where(*conditions)) or 0)
    drivers_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.driver))).where(*conditions)) or 0)

    base_rows, ref_date, previous_date = compute_base_ranking(session, args, conditions)

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

    daily_stmt = (
        select(PNRRecord.data, func.count(PNRRecord.id))
        .where(*conditions)
        .group_by(PNRRecord.data)
        .order_by(PNRRecord.data.asc())
    )
    daily = [{"date": d.isoformat(), "count": int(c)} for d, c in session.execute(daily_stmt)]

    return {
        "kpis": {"total": total, "own": own, "franchise": franchise, "bases": bases_count, "drivers": drivers_count},
        "base_ranking": base_rows,
        "station_summary": station_rows,
        "top_bases": grouped_counts(session, PNRRecord.base, conditions, 10),
        "top_drivers": grouped_counts(session, PNRRecord.driver, conditions, 10),
        "top_origins": grouped_counts(session, PNRRecord.order_source, conditions, 10),
        "daily": daily,
        "rate_reference_date": ref_date.isoformat() if ref_date else None,
        "rate_previous_date": previous_date.isoformat() if previous_date else None,
    }

def compute_dashboard(session, args):
    conditions = build_pnr_conditions(args)
    total = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions)) or 0)
    own = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.station == "Própria")) or 0)
    franchise = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions, PNRRecord.station == "Franquia")) or 0)
    bases_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.base))).where(*conditions)) or 0)
    rms_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.rm_key))).where(*conditions)) or 0)
    drivers_count = int(session.scalar(select(func.count(func.distinct(PNRRecord.driver))).where(*conditions)) or 0)

    rm_rows, ref_date, previous_date = compute_rm_ranking(session, args, conditions)

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

    daily_stmt = (
        select(PNRRecord.data, func.count(PNRRecord.id))
        .where(*conditions)
        .group_by(PNRRecord.data)
        .order_by(PNRRecord.data.asc())
    )
    daily = [{"date": d.isoformat(), "count": int(c)} for d, c in session.execute(daily_stmt)]

    return {
        "kpis": {"total": total, "own": own, "franchise": franchise, "bases": bases_count, "rms": rms_count, "drivers": drivers_count},
        "rm_ranking": rm_rows,
        "station_summary": station_rows,
        "top_bases": grouped_counts(session, PNRRecord.base, conditions, 10),
        "top_drivers": grouped_counts(session, PNRRecord.driver, conditions, 10),
        "top_origins": grouped_counts(session, PNRRecord.order_source, conditions, 10),
        "daily": daily,
        "rate_reference_date": ref_date.isoformat() if ref_date else None,
        "rate_previous_date": previous_date.isoformat() if previous_date else None,
    }


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
            "pnr_source_name": meta.pnr_source_name if meta else None,
            "delivery_source_name": meta.delivery_source_name if meta else None,
            "row_count": meta.pnr_row_count if meta else 0,
            "delivery_row_count": meta.delivery_row_count if meta else 0,
        })


@app.get("/api/filters")
def filters():
    with SessionLocal() as session:
        min_date, max_date = session.execute(select(func.min(PNRRecord.data), func.max(PNRRecord.data))).one()
        delivery_min, delivery_max = session.execute(select(func.min(DeliveryRecord.data), func.max(DeliveryRecord.data))).one()
        meta = session.get(AppMeta, 1)
        payload = {
            "date_min": min_date.isoformat() if min_date else None,
            "date_max": max_date.isoformat() if max_date else None,
            "delivery_date_min": delivery_min.isoformat() if delivery_min else None,
            "delivery_date_max": delivery_max.isoformat() if delivery_max else None,
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
    with SessionLocal() as session:
        return jsonify(compute_dashboard(session, request.args))


@app.get("/api/dashboard-bases")
def dashboard_bases_data():
    with SessionLocal() as session:
        return jsonify(compute_base_dashboard(session, request.args))


@app.get("/api/charts")
def chart_data():
    with SessionLocal() as session:
        pnr_min, pnr_max = session.execute(select(func.min(PNRRecord.data), func.max(PNRRecord.data))).one()
        del_min, del_max = session.execute(select(func.min(DeliveryRecord.data), func.max(DeliveryRecord.data))).one()
        overlap_min = max([d for d in (pnr_min, del_min) if d], default=pnr_min or del_min)
        overlap_max = min([d for d in (pnr_max, del_max) if d], default=pnr_max or del_max)
        start = parse_date(request.args.get("start_date")) or overlap_min
        end = parse_date(request.args.get("end_date")) or overlap_max
        if not start or not end:
            return jsonify({"cards": {"total": 0, "value": 0, "own": 0, "franchise": 0}, "series": [], "dates": []})
        if start > end:
            start, end = end, start

        regional = clean_text(request.args.get("regional"))
        requested_rms = [clean_text(v) for v in request.args.getlist("rm") if clean_text(v)]
        if not requested_rms:
            csv_rms = clean_text(request.args.get("rms"))
            if csv_rms:
                requested_rms = [v.strip() for v in csv_rms.split("|") if v.strip()]
        requested_keys = {join_key(v) for v in requested_rms if join_key(v)}

        pnr_conditions = [PNRRecord.data >= start, PNRRecord.data <= end]
        del_conditions = [DeliveryRecord.data >= start, DeliveryRecord.data <= end]
        if regional and regional != "__all__":
            pnr_conditions.append(PNRRecord.filial == regional)
            del_conditions.append(DeliveryRecord.filial == regional)
        if requested_keys:
            pnr_conditions.append(PNRRecord.rm_key.in_(requested_keys))
            del_conditions.append(DeliveryRecord.rm_key.in_(requested_keys))

        rm_rows = session.execute(
            select(PNRRecord.rm_key, func.min(PNRRecord.rm)).where(*pnr_conditions).group_by(PNRRecord.rm_key).order_by(func.min(PNRRecord.rm))
        ).all()
        display_map = {k or "": (v or "Não informado") for k, v in rm_rows}
        if requested_keys:
            for key in requested_keys:
                display_map.setdefault(key, next((v for v in requested_rms if join_key(v) == key), key))

        pnr_daily = {}
        for d, key, count, value_sum in session.execute(
            select(PNRRecord.data, PNRRecord.rm_key, func.count(PNRRecord.id), func.sum(PNRRecord.merchandise_value))
            .where(*pnr_conditions)
            .group_by(PNRRecord.data, PNRRecord.rm_key)
        ):
            pnr_daily[(d, key or "")] = (int(count or 0), float(value_sum or 0))

        delivery_daily = {}
        for d, key, qty in session.execute(
            select(DeliveryRecord.data, DeliveryRecord.rm_key, func.sum(DeliveryRecord.delivered_qty))
            .where(*del_conditions)
            .group_by(DeliveryRecord.data, DeliveryRecord.rm_key)
        ):
            delivery_daily[(d, key or "")] = float(qty or 0)
            if (key or "") not in display_map:
                name = session.scalar(select(func.min(DeliveryRecord.rm)).where(DeliveryRecord.rm_key == (key or "")))
                display_map[key or ""] = name or "Não informado"

        keys = sorted([k for k in display_map.keys() if k], key=lambda k: display_map[k].lower())
        dates = []
        cursor = start
        while cursor <= end:
            dates.append(cursor)
            cursor += timedelta(days=1)

        series = []
        for key in keys:
            points = []
            for d in dates:
                complaints, _ = pnr_daily.get((d, key), (0, 0.0))
                deliveries = delivery_daily.get((d, key), 0.0)
                points.append({
                    "date": d.isoformat(),
                    "complaints": complaints,
                    "deliveries": round(deliveries, 2),
                    "rate": safe_rate(complaints, deliveries),
                })
            series.append({"rm": display_map[key], "rm_key": key, "points": points})

        total = int(session.scalar(select(func.count(PNRRecord.id)).where(*pnr_conditions)) or 0)
        value_total = float(session.scalar(select(func.sum(PNRRecord.merchandise_value)).where(*pnr_conditions)) or 0)
        own = int(session.scalar(select(func.count(PNRRecord.id)).where(*pnr_conditions, PNRRecord.station == "Própria")) or 0)
        franchise = int(session.scalar(select(func.count(PNRRecord.id)).where(*pnr_conditions, PNRRecord.station == "Franquia")) or 0)

        return jsonify({
            "cards": {"total": total, "value": round(value_total, 2), "own": own, "franchise": franchise},
            "series": series,
            "dates": [d.isoformat() for d in dates],
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        })


def make_header_cells(ws, headers):
    fill = PatternFill("solid", fgColor="ED1C24")
    font = Font(color="FFFFFF", bold=True)
    cells = []
    for value in headers:
        cell = WriteOnlyCell(ws, value=value)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center")
        cells.append(cell)
    return cells


def append_write_sheet(wb, title, headers, rows):
    ws = wb.create_sheet(title=title[:31])
    ws.freeze_panes = "A2"
    ws.append(make_header_cells(ws, headers))
    for row in rows:
        ws.append(row)
    return ws


@app.get("/api/export")
def export_tables():
    lang = clean_text(request.args.get("lang")) or "pt-BR"
    mode = clean_text(request.args.get("mode"))
    with SessionLocal() as session:
        dashboard = compute_base_dashboard(session, request.args) if mode == "bases" else compute_dashboard(session, request.args)
        conditions = build_pnr_conditions(request.args)
        meta = session.get(AppMeta, 1)
        try:
            raw_headers = json.loads(meta.pnr_headers_json or "[]") if meta else []
        except json.JSONDecodeError:
            raw_headers = []
        if not raw_headers:
            raw_headers = ["Data", "Filial", "Número do ticket", "Origem do Pedido", "Base", "Motorista", "RM", "Supervisor", "Estação", "Atendimento", "Motivo N1", "Motivo N2", "Valor da mercadoria"]

        wb = Workbook(write_only=True)
        if mode == "bases":
            base_headers = ["排名", "网点", "网点类型", "PNR", "货值", "PNR率", "前一日PNR率", "较前一日变化"] if lang == "zh-CN" else ["Ranking", "Base", "Tipo de estação", "PNR", "Valor da mercadoria", "Taxa PNR", "Taxa PNR D-1", "Variação D-1"]
            base_rows = []
            for i, row in enumerate(dashboard["base_ranking"], 1):
                base_rows.append([i, row["base"], row["station"], row["count"], row["merchandise_value"], row["rate"], row["previous_rate"], row["variation"]])
            append_write_sheet(wb, "网点排名" if lang == "zh-CN" else "Ranking Bases", base_headers, base_rows)
        else:
            rm_headers = ["排名", "RM", "PNR", "直营网点", "加盟网点", "货值", "PNR率", "前一日PNR率", "较前一日变化"] if lang == "zh-CN" else ["Ranking", "RM", "PNR", "Base própria", "Franquia", "Valor da mercadoria", "Taxa PNR", "Taxa PNR D-1", "Variação D-1"]
            rm_rows = []
            for i, row in enumerate(dashboard["rm_ranking"], 1):
                rm_rows.append([i, row["rm"], row["count"], row["own"], row["franchise"], row["merchandise_value"], row["rate"], row["previous_rate"], row["variation"]])
            append_write_sheet(wb, "RM排名" if lang == "zh-CN" else "Ranking RM", rm_headers, rm_rows)

        station_headers = ["网点类型", "PNR", "占比", "网点数量", "主要网点"] if lang == "zh-CN" else ["Tipo de estação", "PNR", "Participação", "Bases", "Top base"]
        station_rows = [[r["station"], r["count"], r["share"] / 100, r["bases"], r["top_base"]] for r in dashboard["station_summary"]]
        append_write_sheet(wb, "直营网点与加盟网点" if lang == "zh-CN" else "Própria x Franquia", station_headers, station_rows)

        rank_headers = ["排名", "名称", "PNR"] if lang == "zh-CN" else ["Ranking", "Nome", "PNR"]
        append_write_sheet(wb, "TOP10网点" if lang == "zh-CN" else "Top 10 Bases", rank_headers, [[i, r["label"], r["count"]] for i, r in enumerate(dashboard["top_bases"], 1)])
        append_write_sheet(wb, "TOP10司机" if lang == "zh-CN" else "Top 10 Motoristas", rank_headers, [[i, r["label"], r["count"]] for i, r in enumerate(dashboard["top_drivers"], 1)])
        append_write_sheet(wb, "TOP10订单来源" if lang == "zh-CN" else "Top 10 Origens", rank_headers, [[i, r["label"], r["count"]] for i, r in enumerate(dashboard["top_origins"], 1)])
        append_write_sheet(wb, "每日PNR" if lang == "zh-CN" else "PNR por dia", ["日期", "PNR"] if lang == "zh-CN" else ["Data", "PNR"], [[r["date"], r["count"]] for r in dashboard["daily"]])

        raw_query = select(PNRRecord.raw_json).where(*conditions).order_by(PNRRecord.data.asc(), PNRRecord.id.asc()).execution_options(yield_per=2000, stream_results=True)
        raw_count = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions)) or 0)
        page_index = 0
        ws = None
        for idx, (raw_json,) in enumerate(session.execute(raw_query)):
            if idx % RAW_EXPORT_PAGE_SIZE == 0:
                page_index += 1
                title = "PNR BI" if raw_count <= RAW_EXPORT_PAGE_SIZE else f"PNR BI {page_index}"
                ws = wb.create_sheet(title=title[:31])
                ws.freeze_panes = "A2"
                ws.append(make_header_cells(ws, raw_headers))
            try:
                values = json.loads(raw_json or "[]")
            except json.JSONDecodeError:
                values = []
            if len(values) < len(raw_headers):
                values.extend([None] * (len(raw_headers) - len(values)))
            ws.append(values[: len(raw_headers)])
        if raw_count == 0:
            ws = wb.create_sheet(title="PNR BI")
            ws.append(make_header_cells(ws, raw_headers))

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return send_file(buffer, as_attachment=True, download_name=f"Indicador_PNR_{stamp}.xlsx", mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.post("/api/upload")
def upload_data():
    provided = request.headers.get("X-Admin-Key", "").strip() or request.form.get("admin_key", "").strip()
    if provided != EDIT_PASSWORD:
        return jsonify({"ok": False, "message": "Senha inválida. As alterações não foram aplicadas."}), 401

    pnr_uploaded = request.files.get("pnr_file")
    delivery_uploaded = request.files.get("delivery_file")
    if not pnr_uploaded or not pnr_uploaded.filename or not delivery_uploaded or not delivery_uploaded.filename:
        return jsonify({"ok": False, "message": "As duas planilhas são obrigatórias: PNR BI e Entregas BI."}), 400
    if not pnr_uploaded.filename.lower().endswith(".xlsx") or not delivery_uploaded.filename.lower().endswith(".xlsx"):
        return jsonify({"ok": False, "message": "As duas planilhas devem estar no formato .xlsx."}), 400

    with IMPORT_LOCK:
        temp_paths = []
        try:
            with NamedTemporaryFile(delete=False, suffix="_pnr.xlsx") as tmp_pnr:
                pnr_uploaded.save(tmp_pnr.name)
                temp_paths.append(tmp_pnr.name)
            with NamedTemporaryFile(delete=False, suffix="_entregas.xlsx") as tmp_delivery:
                delivery_uploaded.save(tmp_delivery.name)
                temp_paths.append(tmp_delivery.name)

            pnr_records, pnr_skipped, headers = parse_pnr_workbook(temp_paths[0])
            delivery_records, delivery_skipped = parse_delivery_workbook(temp_paths[1])
            replace_all_data(pnr_records, delivery_records, pnr_uploaded.filename, delivery_uploaded.filename, headers)
            with SessionLocal() as session:
                meta = session.get(AppMeta, 1)
            return jsonify({
                "ok": True,
                "message": "PNR BI e Entregas BI atualizadas com sucesso.",
                "rows": len(pnr_records),
                "delivery_rows": len(delivery_records),
                "skipped": pnr_skipped,
                "delivery_skipped": delivery_skipped,
                "version": meta.version if meta else None,
            })
        except ValueError as exc:
            return jsonify({"ok": False, "message": str(exc)}), 400
        except Exception as exc:
            app.logger.exception("Falha ao importar planilhas")
            return jsonify({"ok": False, "message": f"Erro ao importar: {exc}"}), 500
        finally:
            for temp_path in temp_paths:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass


def _provided_admin_key(payload=None):
    payload = payload or {}
    return request.headers.get("X-Admin-Key", "").strip() or clean_text(payload.get("admin_key")) or request.form.get("admin_key", "").strip() or request.args.get("admin_key", "").strip()


def require_admin(payload=None):
    if _provided_admin_key(payload) != EDIT_PASSWORD:
        return jsonify({"ok": False, "message": "Senha inválida. As alterações não foram aplicadas."}), 401
    return None


def bump_meta(session, source_name="Edição pelo dashboard"):
    meta = session.get(AppMeta, 1)
    pnr_count = int(session.scalar(select(func.count()).select_from(PNRRecord)) or 0)
    delivery_count = int(session.scalar(select(func.count()).select_from(DeliveryRecord)) or 0)
    if not meta:
        meta = AppMeta(id=1, version=1, updated_at=datetime.utcnow(), pnr_source_name=source_name, delivery_source_name="Entregas BI", pnr_row_count=pnr_count, delivery_row_count=delivery_count, pnr_headers_json="[]")
        session.add(meta)
    else:
        meta.version += 1
        meta.updated_at = datetime.utcnow()
        meta.pnr_source_name = source_name
        meta.pnr_row_count = pnr_count
        meta.delivery_row_count = delivery_count
    session.flush()
    return meta


def build_editor_conditions(args):
    cond = build_pnr_conditions(args)
    query = clean_text(args.get("q"))
    if query:
        token = f"%{query}%"
        cond.append(or_(
            PNRRecord.ticket_number.ilike(token), PNRRecord.order_source.ilike(token), PNRRecord.base.ilike(token),
            PNRRecord.driver.ilike(token), PNRRecord.rm.ilike(token), PNRRecord.supervisor.ilike(token),
            PNRRecord.atendimento.ilike(token), PNRRecord.filial.ilike(token), PNRRecord.issue_l1.ilike(token), PNRRecord.issue_l2.ilike(token),
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
        "merchandise_value": row.merchandise_value or 0,
    }


def meta_headers(session):
    meta = session.get(AppMeta, 1)
    try:
        return json.loads(meta.pnr_headers_json or "[]") if meta else []
    except json.JSONDecodeError:
        return []


def raw_index_map(headers):
    normalized = {normalize_header(h): i for i, h in enumerate(headers)}
    result = {}
    for key, aliases in PNR_HEADER_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                result[key] = normalized[alias]
                break
    return result


def apply_record_values(row, values, headers):
    parsed_date = parse_date(values.get("data"))
    if not parsed_date:
        raise ValueError("Data inválida.")
    row.data = parsed_date
    row.filial = normalize_value(values.get("filial"))
    row.ticket_number = clean_text(values.get("ticket_number"))
    row.order_source = normalize_value(values.get("order_source"))
    row.base = normalize_value(values.get("base"), "Sem base")
    row.driver = normalize_value(values.get("driver"))
    row.rm = normalize_value(values.get("rm"))
    row.rm_key = join_key(row.rm)
    row.supervisor = normalize_value(values.get("supervisor"))
    row.station = normalize_station(values.get("station"), row.base)
    row.atendimento = normalize_value(values.get("atendimento"))
    row.issue_l1 = clean_text(values.get("issue_l1"))
    row.issue_l2 = clean_text(values.get("issue_l2"))
    row.merchandise_value = parse_number(values.get("merchandise_value"))

    try:
        raw_values = json.loads(row.raw_json or "[]")
    except json.JSONDecodeError:
        raw_values = []
    if len(raw_values) < len(headers):
        raw_values.extend([None] * (len(headers) - len(raw_values)))
    index_map = raw_index_map(headers)
    mapped_values = {
        "data": row.data.isoformat(), "filial": row.filial, "ticket_number": row.ticket_number,
        "order_source": row.order_source, "base": row.base, "driver": row.driver, "rm": row.rm,
        "supervisor": row.supervisor, "station": row.station, "atendimento": row.atendimento,
        "issue_l1": row.issue_l1, "issue_l2": row.issue_l2, "merchandise_value": row.merchandise_value,
    }
    for key, value in mapped_values.items():
        if key in index_map:
            raw_values[index_map[key]] = value
    row.raw_json = json.dumps(raw_values, ensure_ascii=False)


@app.get("/api/editor/rows")
def editor_rows():
    conditions = build_editor_conditions(request.args)
    try:
        page = max(int(request.args.get("page", 1)), 1)
    except ValueError:
        page = 1
    try:
        page_size = min(max(int(request.args.get("page_size", 50)), 10), 200)
    except ValueError:
        page_size = 50
    with SessionLocal() as session:
        total = int(session.scalar(select(func.count(PNRRecord.id)).where(*conditions)) or 0)
        pages = max(math.ceil(total / page_size), 1)
        page = min(page, pages)
        stmt = select(PNRRecord).where(*conditions).order_by(PNRRecord.data.desc(), PNRRecord.id.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = [record_payload(row) for row in session.scalars(stmt)]
        return jsonify({"rows": rows, "page": page, "pages": pages, "total": total, "page_size": page_size})


@app.post("/api/editor/save")
def editor_save():
    payload = request.get_json(silent=True) or {}
    auth_error = require_admin(payload)
    if auth_error:
        return auth_error
    rows = payload.get("rows") or []
    if not rows:
        return jsonify({"ok": False, "message": "Nenhuma alteração recebida."}), 400
    try:
        with SessionLocal.begin() as session:
            headers = meta_headers(session)
            saved = 0
            for values in rows:
                row_id = values.get("id")
                if row_id:
                    row = session.get(PNRRecord, int(row_id))
                    if not row:
                        continue
                else:
                    row = PNRRecord(raw_json=json.dumps([None] * len(headers), ensure_ascii=False))
                    session.add(row)
                apply_record_values(row, values, headers)
                saved += 1
            meta = bump_meta(session)
            version_value = meta.version
        return jsonify({"ok": True, "saved": saved, "version": version_value})
    except ValueError as exc:
        return jsonify({"ok": False, "message": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Falha ao salvar edição")
        return jsonify({"ok": False, "message": f"Erro ao salvar: {exc}"}), 500


@app.delete("/api/editor/rows/<int:row_id>")
def editor_delete(row_id):
    payload = request.get_json(silent=True) or {}
    auth_error = require_admin(payload)
    if auth_error:
        return auth_error
    with SessionLocal.begin() as session:
        row = session.get(PNRRecord, row_id)
        if not row:
            return jsonify({"ok": False, "message": "Registro não encontrado."}), 404
        session.delete(row)
        session.flush()
        meta = bump_meta(session)
        version_value = meta.version
    return jsonify({"ok": True, "version": version_value})


@app.errorhandler(413)
def too_large(_):
    return jsonify({"ok": False, "message": "Arquivo muito grande. Limite total: 80 MB."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
