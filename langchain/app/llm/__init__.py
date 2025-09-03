from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from app import config

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

# else:
#     qdrant.delete("qdrant_collection")
#     qdrant.create_collection(
#         collection_name="qdrant_collection",
#         vectors_config=VectorParams(size=768, distance=Distance.COSINE)
#     )