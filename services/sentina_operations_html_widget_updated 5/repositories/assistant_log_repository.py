from typing import List, Dict, Any

LOG_STORE: List[Dict[str, Any]] = []


class AssistantLogRepository:

    @staticmethod
    def add_log(log: Dict[str, Any]):
        LOG_STORE.append(log)

    @staticmethod
    def get_all_logs():
        return LOG_STORE

    @staticmethod
    def get_logs_by_user(user_id: str):
        return [l for l in LOG_STORE if l["user_id"] == user_id]

    @staticmethod
    def get_logs_by_role(role: str):
        return [l for l in LOG_STORE if l["role"] == role]