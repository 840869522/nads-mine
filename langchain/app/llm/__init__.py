from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from app import config
from .CustomEmbeddings import CustomEmbeddings

try:
    qdrant = QdrantClient(
        path="./qdrant_db_file"
    )
    if not qdrant.collection_exists("qdrant_collection"):
        qdrant.create_collection(
            collection_name="qdrant_collection",
            vectors_config=VectorParams(size=768, distance=Distance.COSINE)
        )
except:
    qdrant.close()


embedding_model = CustomEmbeddings(
    model=config['embeddingModel']['model'],
    base_url=config['embeddingModel']['base_url'],
    api_key=config['embeddingModel']['api_key'],
)


vector_store = QdrantVectorStore(
    client=qdrant,
    collection_name="qdrant_collection",
    embedding=embedding_model
)

# else:
#     qdrant.delete("qdrant_collection")
#     qdrant.create_collection(
#         collection_name="qdrant_collection",
#         vectors_config=VectorParams(size=768, distance=Distance.COSINE)
#     )