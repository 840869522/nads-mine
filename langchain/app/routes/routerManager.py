class RouterManager:
    def __init__(self):
        self.router = []

    def add_router(self, router):
        self.router.append(router)

    def remove_router(self, router):
        self.router.remove(router)

    def get_all_route(self):
        return self.router
