from langchain_openai.chat_models import ChatOpenAI
from langchain_core.embeddings import Embeddings
import requests
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
from app import config



class CustomEmbeddings(Embeddings):
    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    def embed_documents(self, texts):
        url = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "input": texts,
            "model": self.model
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
            raise Exception(f"Embedding failed: {response.text}")
        return [item["embedding"] for item in response.json()["data"]]

    def embed_query(self, text):
        return self.embed_documents([text])[0]



system_template = """
    你是一个非常有用的问答助手，根据下面给出的知识和以往的对话，
    回答给出的问题,当你知道问题的答案时，准确的回答问题；如果你不知道答案，那么直接回答“我不知道”。
    知识：{knowledge}
"""


human_template = """
    问题：{question}
"""

chat_template = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(system_template),
    MessagesPlaceholder(variable_name="history"),
    HumanMessagePromptTemplate.from_template(human_template)
]
)

chat_llm = ChatOpenAI(
    model=config['chatModel']['model'],
    base_url=config['chatModel']['base_url'],
    api_key=config['chatModel']['api_key'],
)

embedding_model_open = OpenAIEmbeddings(
    model=config['embeddingModel']['model'],
    base_url="http://43.143.151.41:3000",
    api_key=config['embeddingModel']['api_key']
)

embedding_model = CustomEmbeddings(
    model=config['embeddingModel']['model'],
    base_url=config['embeddingModel']['base_url'],
    api_key=config['embeddingModel']['api_key'],
)

try:
    test_vector = embedding_model.embed_documents(["test"])[0]
    vector_size = len(test_vector)
    print(f"Embedding vector size: {vector_size}")
except Exception as e:
    raise RuntimeError("嵌入模型调用失败，请检查 API 配置和服务状态") from e

vector_store = QdrantVectorStore(
    client=qdrant,
    collection_name="qdrant_collection",
    embedding=embedding_model
)

chat_memory = ConversationBufferMemory(
    chat_memory=FileChatMessageHistory(file_path="./history.txt"),
    memory_key="history",
    return_messages=True,
    max_message = 10
)

retriever = vector_store.as_retriever(
    search_type="similarity",
    search_kwargs={'k': 6}
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
            "history": itemgetter("history")
        }
        # | RunnableLambda(search_document)
        | chat_template
        | chat_llm
        | StrOutputParser()
)

rag_chain_memory = RunnableWithMessageHistory(
    rag_chain,
    get_session_history=lambda session_id: chat_memory.chat_memory,
    # SQLChatMessageHistory(
    #     connection_string = config['database']["uri"],
    #     table_name= config['database']['table']
    #     session_id=session_id,
    #     session_id_field_name="session_id"
    # ),
    input_messages_key="question",
    history_messages_key="history"
)


async def generate_response(message: str):
    async for chunk in rag_chain_memory.astream({"question": message}, {"configurable": {"session_id": "session_123"}}):
        yield f"data: {chunk}\n\n"
