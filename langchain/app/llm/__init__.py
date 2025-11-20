from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, ScalarQuantization, ScalarQuantizationConfig, ScalarType, HnswConfigDiff, OptimizersConfigDiff
from app import config
from .CustomEmbeddings import CustomEmbeddings
from langchain_qdrant import QdrantVectorStore
import os
os.environ['NLTK_DATA'] = '/home/ubunut/nltk_data'

try:
    qdrant = QdrantClient(
        url=config['qdrant']['server']
    )
    if not qdrant.collection_exists("qdrant_collection"):
        qdrant.create_collection(
            collection_name="qdrant_collection",
            vectors_config=VectorParams(
                size=768,
                distance=Distance.COSINE,
                hnsw_config=HnswConfigDiff(
                    m=16,
                    ef_construct=100
                ),
                quantization_config=ScalarQuantization(
                    scalar=ScalarQuantizationConfig(
                        type=ScalarType.INT8,
                        always_ram=True,
                    ),
                ),
            ),
            optimizers_config=OptimizersConfigDiff(
                deleted_threshold=0.2,
                max_segment_size=1000000,
                indexing_threshold=20000,
            )
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
