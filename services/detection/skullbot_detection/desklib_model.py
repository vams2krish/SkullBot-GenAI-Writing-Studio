"""Local implementation of the published Desklib mean-pooling/linear-head architecture.

Weights: desklib/ai-text-detector-v1.01 (MIT). No remote Python code executes.
The two-logit view preserves exactly sigmoid(single_logit) for class AI.
"""
import torch
from torch import nn
from transformers import AutoModel, DebertaV2Config, PreTrainedModel
from transformers.modeling_outputs import SequenceClassifierOutput


class DesklibClassifier(PreTrainedModel):
    config_class = DebertaV2Config

    def __init__(self, config):
        super().__init__(config)
        # These member names match the published checkpoint tensor keys.
        self.model = AutoModel.from_config(config, trust_remote_code=False)
        self.classifier = nn.Linear(config.hidden_size, 1)
        self.post_init()

    def forward(self, input_ids, attention_mask=None, **kwargs):
        state = self.model(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        mask = (attention_mask if attention_mask is not None else torch.ones_like(input_ids)).unsqueeze(-1).to(state.dtype)
        pooled = (state * mask).sum(1) / mask.sum(1).clamp_min(1e-9)
        score = self.classifier(pooled)
        return SequenceClassifierOutput(logits=torch.cat((torch.zeros_like(score), score), dim=-1))
