from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings
from app.routers.health_router import router as health_router
from app.routers.process_router import gateway_router as gateway_process_router
from app.routers.process_router import router as process_router
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
app.include_router(process_router)
app.include_router(gateway_process_router)


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={'success': False, 'detail': str(exc)})


@app.exception_handler(SheetValidationError)
async def sheet_validation_handler(_: Request, exc: SheetValidationError):
    return JSONResponse(status_code=422, content=exc.to_response())


@app.exception_handler(KeyError)
async def key_error_handler(_: Request, exc: KeyError):
    detail = str(exc).replace("'", '')
    return JSONResponse(
        status_code=422,
        content={
            'success': False,
            'detail': detail,
            'error': {'code': 'KEY_ERROR', 'message': detail},
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={'success': False, 'detail': f'Processing failure: {str(exc)}'},
    )
