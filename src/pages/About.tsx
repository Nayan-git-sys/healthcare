import { Card, DisclaimerBanner, InfoNote } from '../components/ui'

interface StackItem {
  area: string
  tools: string
  note: string
}

const STACK: StackItem[] = [
  { area: 'Frontend', tools: 'React 19 · TypeScript · Tailwind CSS · Recharts', note: 'Dashboard, upload UX and charts; no observer sees raw tensors.' },
  { area: 'Backend', tools: 'Python 3.13 · FastAPI · uvicorn', note: 'REST API, upload validation, session history, CORS.' },
  { area: 'AI framework', tools: 'PyTorch · torchvision (CPU)', note: 'Inference and gradient computation for Grad-CAM.' },
  { area: 'Model', tools: 'Compact 4-block CNN (baseline) on grayscale input', note: 'Trained with class-weighted cross-entropy + light augmentation.' },
  { area: 'Explainability', tools: 'Grad-CAM (Selvaraju et al., 2017)', note: 'Forward/backward hooks on the last conv layer; jet-like colormap.' },
  { area: 'Dataset', tools: 'PneumoniaMNIST (MedMNIST v2, CC BY-NC-SA 4.0)', note: 'NIH CSP + Guangzhou Medical Center pediatric chest X-rays, binary Normal/Pneumonia split.' },
]

const LIMITS: string[] = [
  'The model was trained on a small, pre-resized public dataset (PneumoniaMNIST); it does not see real-world scanner variety, and performance will not transfer to your hospital data.',
  'Model scores are softmax class scores, not calibrated probabilities (no temperature scaling / calibration here). Never present them as “90% chance of pneumonia”.',
  'Grad-CAM shows where the network weighted its decision, but that weighting can itself be wrong. A suitable-looking heatmap does not validate a diagnosis.',
  'Uploads are processed in memory and per-session history is stored in RAM only; nothing is persisted to a database. Still, only upload images you are permitted to process.',
  'This software cannot diagnose, treat, or rule out any condition and must never influence patient care.',
]

export default function About() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-700">About MedVision AI</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">
          MedVision AI is a final-year Computer Science / Data Science
          for education: an end-to-end, explainable deep-learning pipeline
          for chest X-ray classification. It combines a real PyTorch training
          pipeline, REST inference,and Grad-CAM-based interpretability behind a polished dashboard UI.
        </p>
      </div>

      <InfoNote tone="amber">
        <strong>Honest scope.</strong> This is an educational research
        prototype, not a medical device, and it has no regulatory clearance. It
        cannot and does not confirm, rule out or measure any disease.
      </InfoNote>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How it works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-slate-600">
          <li><strong>Training (offline):</strong> the PneumoniaMNIST training split (~4,700 grayscale chest X-rays) is augmented lightly (small rotations, flips, jitter) and fed to a CNN with class-weighted cross-entropy. The checkpoint with the best validation balanced accuracy is saved to <code>backend/models/best_model.pth</code>, storing normalization statistics and architecture metadata.</li>
          <li><strong>Inference (server):</strong> an uploaded image is byte-validated, decoded with Pillow into grayscale, resized with bilinear interpolation to the training resolution (stored in the checkpoint), normalized with the training statistics and passed through the model.</li>
          <li><strong>Explainability:</strong> activations and gradients of the last convolutional layer are captured with hooks. Global-average-pooled gradients weight each feature map; the weighted sum is rectified, normalized, resized to the original image size and rendered with a jet-like colormap for the heatmap overlay.</li>
          <li><strong>API + UI:</strong> FastAPI returns the prediction, class scores, original image and heatmap as base64 PNGs. The React app renders them with an adjustable opacity slider and honest charts.</li>
        </ol>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Technology stack</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {STACK.map((s) => (
            <div key={s.area} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-500">{s.area}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-navy-700">{s.tools}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{s.note}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Known limitations</h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-600">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="mt-0.5 text-amber-500">▸</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Data &amp; license notes</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          PneumoniaMNIST comes from the MedMNIST v2 collection
          (zenodo.org/records/10519652, <strong>CC BY-NC-SA 4.0</strong>) and is
          licensed for <strong>non-commercial</strong> use only. The underlying
          collections (NIH ChestX-ray14 and the Guangzhou Medical Center
          pneumonia cohort) carry their own terms. This repository's code is
          for education. Always cite the MedMNIST papers if the trained model is
          used in coursework or research.
        </p>
      </Card>

      <DisclaimerBanner />
    </div>
  )
}
