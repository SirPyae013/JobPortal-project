from rest_framework.exceptions import APIException


class EmailDeliveryUnavailable(APIException):
    status_code = 503
    default_detail = "We couldn't send the email right now. Please try again shortly."
    default_code = "email_delivery_unavailable"
