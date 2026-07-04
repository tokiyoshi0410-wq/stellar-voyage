import { startApp, showFatal } from './app';

const root = document.getElementById('app');
if (root) {
  startApp(root).catch(() => showFatal(root, 'アプリの初期化に失敗しました。ページを再読み込みしてください。'));
}
