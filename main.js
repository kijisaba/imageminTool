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
	const outputDir = path.join(__dirname, 'compressed');
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir);
	}

	const compressedFiles = await imagemin(files, {
		destination: outputDir,
		plugins: [
			imageminMozjpeg({ quality: 75 }),
			imageminPngquant({ quality: [0.6, 0.8] }),
			imageminSvgo()
		]
	});

	if (compressedFiles.length === 1) {
		return compressedFiles[0].destinationPath;
	} else {
		const zipPath = path.join(outputDir, 'images.zip');
		const output = fs.createWriteStream(zipPath);
		const archive = archiver('zip', {
			zlib: { level: 9 }
		});

		archive.pipe(output);
		compressedFiles.forEach(file => {
			archive.file(file.destinationPath, { name: path.basename(file.destinationPath) });
		});
		await archive.finalize();

		return zipPath;
	}
});
