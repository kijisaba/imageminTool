import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import imageminSvgo from 'imagemin-svgo';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js') // 必要に応じて修正
		}
	});
	mainWindow.loadFile('index.html'); // 必要に応じて修正
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

ipcMain.handle('select-images', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openFile', 'multiSelections'],
		filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'svg'] }]
	});
	return result.filePaths.slice(0, 20); // 最大20枚
});

ipcMain.handle('compress-images', async (event, files) => {
	// 保存先フォルダを選択するダイアログを表示
	const { canceled, filePaths } = await dialog.showOpenDialog({
		properties: ['openDirectory']
	});
	// キャンセルされた場合は処理を中止
	if (canceled || filePaths.length === 0) {
		return null;
	}

	const outputDir = filePaths[0];

	// 一時ディレクトリを作成して圧縮画像を保存
	const tempDir = path.join(outputDir, 'temp_compressed');
	fs.mkdirSync(tempDir, { recursive: true });

	const compressedFiles = await imagemin(files, {
		destination: tempDir,
		plugins: [
			imageminMozjpeg({ quality: 75 }),
			imageminPngquant({ quality: [0.6, 0.8] }),
			imageminSvgo()
		]
	});

	// ZIPファイルのパスを設定
	const zipPath = path.join(outputDir, 'compressed-images.zip');
	const output = fs.createWriteStream(zipPath);
	const archive = archiver('zip', {
		zlib: { level: 9 }
	});

	// 圧縮した画像をZIPに追加
	archive.pipe(output);
	compressedFiles.forEach(file => {
		archive.file(file.destinationPath, { name: path.basename(file.destinationPath) });
	});

	await archive.finalize();

	// 一時ディレクトリを削除して個別の圧縮画像を削除
	fs.rmSync(tempDir, { recursive: true, force: true });

	// ZIPファイルのパスを返す
	return zipPath;
});
