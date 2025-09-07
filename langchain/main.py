from fastapi import FastAPI
from app.routes.routerManager import RouterManager
from app.controller.llm.chat import chat_route
from app.llm import qdrant
from contextlib import asynccontextmanager
from app import config


@asynccontextmanager
async def lifespan(app: FastAPI):

    yield
    qdrant.close()


app = FastAPI(lifespan=lifespan)


def register_router(app):
    router_manager = RouterManager()
    router_manager.add_router(router=chat_route)
    for router in router_manager.get_all_route():
        app.include_router(router)


register_router(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config['server']['ip'],  port=config['server']['port'])
