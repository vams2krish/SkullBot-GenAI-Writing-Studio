import pytest
from skullbot_detection.config import Settings
from skullbot_detection.model_registry import CATALOG,select_models,available_models
from skullbot_detection.models import encode_texts


def test_profiles_pin_real_model_ids_and_reject_arbitrary_remote_code():
    selected=select_models(Settings(), 'desklib','e5')
    assert selected.ai_model=='desklib/ai-text-detector-v1.01'
    assert selected.embedding_model=='intfloat/multilingual-e5-small'
    assert len(selected.ai_revision)==40 and len(selected.embedding_revision)==40
    assert selected.ai_positive_label=='AI'
    with pytest.raises(ValueError):select_models(Settings(),'arbitrary-user/model')
    assert len(available_models()['ai'])==2


def test_e5_task_prefixes_do_not_leak_into_minilm_input():
    class Encoder:
        def encode(self,texts,**kwargs):return texts
    assert encode_texts(Encoder(),['文化领导'],'intfloat/multilingual-e5-small',True)==['query: 文化领导']
    assert encode_texts(Encoder(),['Evidence'],'intfloat/multilingual-e5-small')==['passage: Evidence']
    assert encode_texts(Encoder(),['Evidence'],'sentence-transformers/all-MiniLM-L6-v2')==['Evidence']


def test_ranking_requires_authenticated_bounded_inputs():
    from fastapi.testclient import TestClient
    from skullbot_detection.api import app
    with TestClient(app) as client:
        assert client.post('/v1/references/rerank',json={'query':'leadership','candidates':[{'id':'a','text':'Leadership'}]}).status_code==401
        assert client.post('/v1/references/rerank',json={'query':'a','candidates':[]},headers={'Authorization':'Bearer '+'a'*40}).status_code==422
