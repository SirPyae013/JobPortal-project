from django.http import FileResponse, Http404


def private_resume_response(field, filename):
    if not field:
        raise Http404("No résumé is available.")
    try:
        handle = field.open("rb")
    except FileNotFoundError as error:
        raise Http404("This résumé file is no longer available.") from error
    response = FileResponse(handle, as_attachment=True, filename=filename, content_type="application/pdf")
    response["Cache-Control"] = "private, no-store"
    return response
