from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response
    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        response.data = {"code": getattr(data["detail"], "code", "error"), "message": str(data["detail"]), "fields": {}}
    else:
        response.data = {"code": "validation_error", "message": "Please correct the highlighted fields.", "fields": data}
    return response
