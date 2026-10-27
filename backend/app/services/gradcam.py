"""Grad-CAM (Selvaraju et al., 2017) implementation with hooks.

Implementation note: we use a *forward* hook plus ``Tensor.retain_grad()``
rather than ``register_full_backward_hook``, because backward hooks fail
("Output of BackwardHookFunction is a view and is being modified inplace")
whenever a module feeding an in-place ReLU is hooked - which is every
conv/BN in a ReLU network. retain_grad() avoids wrapping the graph entirely.
"""
import numpy as np
import torch
import torch.nn as nn


class GradCAM:
    """Class-discriminative localization from activations + gradients.

    Usage:
        cam = GradCAM(model, target_layer)
        heatmap = cam.generate(input_tensor, class_idx)   # np.float32 in [0,1], [H,W]
    """

    def __init__(self, model: nn.Module, target_layer: nn.Module, name: str = ""):
        self.model = model
        self.name = name or getattr(target_layer, "_gradcam_name",
                                    target_layer.__class__.__name__)
        self._act: torch.Tensor | None = None
        self._fh = target_layer.register_forward_hook(self._forward_hook)

    def _forward_hook(self, _m, _inputs, output):
        # keep a graph-connected reference (no detach -> no graph wrapping)
        self._act = output

    def generate(self, input_tensor: torch.Tensor, class_idx: int) -> np.ndarray:
        # forward pass triggers the hook that captures activations
        output = self.model(input_tensor)
        act = self._act
        if act is None:
            raise RuntimeError(
                f"Forward hook did not capture activations for {self.name}.")
        if act.grad_fn is None:
            raise RuntimeError(
                "Captured activations are detached from the graph - run Grad-CAM "
                "outside torch.inference_mode()/no_grad().")
        act.retain_grad()

        self.model.zero_grad(set_to_none=True)
        self.model.zero_grad()
        output[0, class_idx].backward()

        if act.grad is None:
            raise RuntimeError(f"No gradient reached the target layer {self.name}.")
        grads = act.grad
        if float(grads.abs().sum()) == 0.0:
            raise RuntimeError(f"Zero gradients captured for layer {self.name}.")

        acts = act[0]                                  # [C,H,W]
        weights = grads[0].mean(dim=(1, 2))            # channel importance
        cam = torch.relu((weights[:, None, None] * acts).sum(dim=0))
        cam = cam.detach().cpu().numpy().astype(np.float32)
        if cam.size == 0:
            raise RuntimeError("Grad-CAM produced an empty map.")
        hi, lo = float(cam.max()), float(cam.min())
        if hi - lo < 1e-8:
            raise RuntimeError(
                "Grad-CAM produced an (almost) flat map; unusable for explanation.")
        return (cam - lo) / (hi - lo)

    def close(self):
        self._fh.remove()
