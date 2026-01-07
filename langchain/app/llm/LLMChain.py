from langchain_openai.chat_models import ChatOpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from langchain.prompts import MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda, RunnableWithMessageHistory
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import FileChatMessageHistory
from langchain_community.chat_message_histories import SQLChatMessageHistory
from operator import itemgetter
from . import qdrant
from . import vector_store
from app import config
from .StreamOutputHandler import StreamOutputHandler
import base64



system_template = """
你是一个有用的问答助手，根据提供的知识库内容回答问题。
- 如果知道答案，准确简洁地回答
- 如果不知道答案，直接回答"我不知道"
- 使用<think>标签包裹思考过程
- 输出格式使用markdown规范
知识库：{knowledge}
"""


human_template = """
    问题：{question}
"""

chat_template = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(system_template),
    # MessagesPlaceholder(variable_name="history"),
    HumanMessagePromptTemplate.from_template(human_template)
]
)

chat_llm = ChatOpenAI(
    model=config['chatModel']['model'],
    base_url=config['chatModel']['base_url'],
    api_key=config['chatModel']['api_key'],
)

chat_memory = ConversationBufferMemory(
    chat_memory=FileChatMessageHistory(file_path="./history.txt"),
    memory_key="history",
    return_messages=True,
    max_message = 5
)

retriever = vector_store.as_retriever(
    search_type="similarity",
    search_kwargs={
        'k': 6,
        'score_threshold': 0.7,
        'search_params': {
            'hnsw_ef': 50,
        }
    }
)

memory_store = {}


def get_memory_by_id(session_id: str):
    return [""]


def search_document(info):
    docs = retriever.invoke(info['question'])
    knowledge = "\n\n".join([doc.page_content for doc in docs])
    info['knowledge'] = knowledge
    return info


rag_chain = (
        {
            "question": itemgetter("question"),
            # "history": itemgetter("history")
        }
        | RunnableLambda(search_document)
        | chat_template
        | chat_llm
        | StrOutputParser()
)

# rag_chain_memory = RunnableWithMessageHistory(
#     rag_chain,
#     get_session_history=lambda session_id: chat_memory.chat_memory,
#     # SQLChatMessageHistory(
#     #     connection_string = config['database']["uri"],
#     #     table_name= config['database']['table']
#     #     session_id=session_id,
#     #     session_id_field_name="session_id"
#     # ),
#     input_messages_key="question",
#     history_messages_key="history"
# )


async def agenerate_response(message: str):
    handler = StreamOutputHandler(chunk_threshold=3)
    async for chunk in rag_chain.astream({"question": message}, {"configurable": {"session_id": "session_123"}}):
        clear_chunk = chunk.strip()
        if clear_chunk:
            processed_chunk = base64.b64encode(chunk.encode("utf-8")).decode('utf-8')
            yield f"data: {processed_chunk}\n\n"

async def generate_response(message: str):
    try:
        responses = await rag_chain.ainvoke(
            {"question": message},
            {"configurable": {"session_id": "session_123"}}
        )
        return responses
    except Exception as e:
        return f"发生错误: {str(e)}"
