"""Structured sheet / column errors so clients can show *where* validation failed."""

from typing import Any


class SheetValidationError(Exception):
    """Raised when the workbook shape does not match processor requirements."""

    def __init__(self, message: str, *, code: str, **context: Any) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.context = context

    def to_response(self) -> dict[str, Any]:
        err: dict[str, Any] = {'code': self.code, 'message': self.message, **self.context}
        return {'success': False, 'detail': self.message, 'error': err}
