"""Enforce database-backed sessions and roles. Edit for access rules; copy guards for new routes."""

from backend.http.json_api import AppError


async def require_user(request):
    token = request.cookies.get(request.app["settings"].session_cookie_name, "")
    user = await request.app["store"].session(token) if token else None
    if not user:
        raise AppError(401, "not_authenticated", "Login is required.")
    request["current_user"] = user
    return user


def can_review(user):
    return bool(set(user["roles"]) & {"teacher", "admin"})


async def require_reviewer(request):
    user = await require_user(request)
    if not can_review(user):
        raise AppError(403, "not_allowed", "Teacher or admin access is required.")
    return user


async def require_admin(request):
    user = await require_user(request)
    if "admin" not in user["roles"]:
        raise AppError(403, "not_allowed", "Admin access is required.")
    return user
