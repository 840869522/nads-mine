from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from app.llm.LLMChain import generate_response
from app.schema.ChatMessage import ChatMessage
from app.schema.ParseFile import FileParseMessage

from app.llm.ParseFile import parseFile



chat_route = APIRouter(
    prefix="",
    tags=["chat"]
)


@chat_route.post("/achat")
async def asyncChatController(message: ChatMessage):
    return StreamingResponse(agenerate_response(message.message), media_type="text/event-stream")

@chat_route.post("/chat")
async def chatController(message: ChatMessage):
    data = await generate_response(message.message)
    return {"code":200,"message":"SUCCESS","data":data}

@chat_route.post("/parse")
async def parseFileController(message: FileParseMessage):
    code = await parseFile(message.file_path,message.file_type)
    if code:
        return JSONResponse(content={"code": 200, "message": "Success", "data": result})
    else:
        return JSONResponse(content={"code": 200, "message": "Failed", "data": result})

    
