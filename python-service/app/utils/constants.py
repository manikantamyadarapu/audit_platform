PAN_REGEX = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
GST_REGEX = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$'

ALLOWED_EXTENSIONS = {'.xlsx', '.xlsm', '.xls'}
ALLOWED_MIME_TYPES = {
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
}

COMMON_EMPTY_VALUES = {'', 'na', 'n/a', 'none', 'null', 'nan'}
