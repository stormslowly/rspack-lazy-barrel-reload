import { infra } from './infrastructure.js';

sessionStorage.setItem(
  'documentLoads',
  String(Number(sessionStorage.getItem('documentLoads')) + 1),
);
document.body.dataset.infra = infra;

const button = document.createElement('button');
button.id = 'activate';
button.textContent = 'activate lazy feature';
button.onclick = () =>
  import('./feature.js').then(({ value }) => {
    document.body.dataset.feature = value;
  });
document.body.appendChild(button);
