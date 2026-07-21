from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings
from app.utils.logger import get_logger
from app.routers.health_router import router as health_router
from app.routers.cash_ledger_router import gateway_router as gateway_cash_ledger_router
from app.routers.cash_ledger_router import router as cash_ledger_router
from app.routers.negative_bank_router import gateway_router as gateway_negative_bank_router
from app.routers.negative_bank_router import router as negative_bank_router
from app.routers.purchase_router import gateway_router as gateway_purchase_router
from app.routers.purchase_router import router as purchase_router
from app.routers.sales_router import gateway_router as gateway_sales_router
from app.routers.sales_router import router as sales_router
from app.routers.sales_return_router import gateway_router as gateway_sales_return_router
from app.routers.sales_return_router import router as sales_return_router
from app.routers.pan_router import gateway_router as gateway_pan_router
from app.routers.pan_router import router as pan_router
from app.routers.gross_weight_router import gateway_router as gateway_gross_weight_router
from app.routers.gross_weight_router import router as gross_weight_router
from app.routers.diamond_rate_rules_router import gateway_router as gateway_diamond_rate_rules_router
from app.routers.diamond_rate_rules_router import router as diamond_rate_rules_router
from app.routers.rate_book_router import gateway_router as gateway_rate_book_router
from app.routers.rate_book_router import router as rate_book_router
from app.routers.rate_rules_router import gateway_router as gateway_rate_rules_router
from app.routers.rate_rules_router import router as rate_rules_router
from app.routers.tds_router import gateway_router as gateway_tds_router
from app.routers.tds_router import router as tds_router
from app.utils.sheet_validation_error import SheetValidationError

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version='1.0.0',
    docs_url='/docs',
    redoc_url='/redoc',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['GET', 'POST', 'OPTIONS'],
    allow_headers=['*'],
    expose_headers=['Content-Disposition'],
)

app.include_router(health_router)
app.include_router(cash_ledger_router)
app.include_router(gateway_cash_ledger_router)
app.include_router(negative_bank_router)
app.include_router(gateway_negative_bank_router)
app.include_router(purchase_router)
app.include_router(gateway_purchase_router)
app.include_router(sales_router)
app.include_router(gateway_sales_router)
app.include_router(sales_return_router)
app.include_router(gateway_sales_return_router)
app.include_router(pan_router)
app.include_router(gateway_pan_router)
app.include_router(gross_weight_router)
app.include_router(gateway_gross_weight_router)
app.include_router(rate_rules_router)
app.include_router(gateway_rate_rules_router)
app.include_router(diamond_rate_rules_router)
app.include_router(gateway_diamond_rate_rules_router)
app.include_router(rate_book_router)
app.include_router(gateway_rate_book_router)
app.include_router(tds_router)
app.include_router(gateway_tds_router)


@app.on_event("startup")
async def startup_event():
    print("\n=== REGISTERED ROUTES ===")
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            methods = route.methods if route.methods else set()
            print(f"{methods} {route.path}")
    print("========================\n")
    
    # Specifically check for cash-ledger routes
    print("\n=== CASH LEDGER ROUTES ===")
    cash_ledger_found = False
    for route in app.routes:
        if hasattr(route, 'path') and 'cash-ledger' in route.path:
            methods = route.methods if route.methods else set()
            print(f"{methods} {route.path}")
            cash_ledger_found = True
    if not cash_ledger_found:
        print("WARNING: NO CASH LEDGER ROUTES FOUND!")
    print("==========================\n")


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={'success': False, 'detail': str(exc)})


@app.exception_handler(SheetValidationError)
async def sheet_validation_handler(_: Request, exc: SheetValidationError):
    return JSONResponse(status_code=422, content=exc.to_response())


@app.exception_handler(KeyError)
async def key_error_handler(_: Request, exc: KeyError):
    import traceback

    detail = str(exc).replace("'", '')
    tb = traceback.format_exc()
    get_logger('key-error').error('KeyError: {}\nTraceback:\n{}', detail, tb)
    return JSONResponse(
        status_code=422,
        content={
            'success': False,
            'detail': f"Missing column: {detail}. Check your Excel headers.",
            'error': {'code': 'KEY_ERROR', 'message': detail},
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception):
    get_logger('api-error').exception('Unhandled exception')
    return JSONResponse(
        status_code=500,
        content={'success': False, 'message': 'Internal server error'},
    )
