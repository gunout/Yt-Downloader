const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Dossier temporaire
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Génère une commande yt-dlp avec métadonnées
function generateYtdlpCommand(url, outputPath, quality, isPlaylist) {
  const metadataOptions = [
    '--add-metadata',
    '--embed-thumbnail',
    '--parse-metadata "title:%(meta_title)s"',
    '--parse-metadata "uploader:%(meta_artist)s"',
    '--parse-metadata "description:%(meta_description)s"'
  ];

  const baseCommand = [
    'yt-dlp',
    '--extract-audio',
    '--audio-format mp3',
    ...metadataOptions,
    `--audio-quality ${quality || '192'}K`,
    '--force-ipv4',
    '--geo-bypass',
    '--no-check-certificate',
    '--compat-options no-certifi',
    '--retries 3',
    '--socket-timeout 30',
    '--source-address 0.0.0.0',
    '--limit-rate 2M',
    isPlaylist ? '--yes-playlist' : '--no-playlist',
    '--ignore-errors',
    '--no-warnings',
    '--no-continue',
    '--newline'
  ];

  if (isPlaylist) {
    const playlistDir = path.join(TEMP_DIR, `playlist_${Date.now()}`);
    fs.mkdirSync(playlistDir);
    
    return [
      ...baseCommand,
      `-o "${path.join(playlistDir, '%(title)s.%(ext)s')}"`,
      `"${url}"`,
      '&&',
      'cd', `"${playlistDir}"`, '&&',
      'zip', '-j', `"${outputPath}"`, '*.mp3', '&&',
      'cd', '..', '&&',
      'rm', '-rf', `"${playlistDir}"`
    ].join(' ');
  } else {
    return [
      ...baseCommand,
      `-o "${outputPath}"`,
      `"${url}"`
    ].join(' ');
  }
}

// Route de téléchargement
app.post('/download', async (req, res) => {
  const { url, quality, isPlaylist } = req.body;
  
  if (!url || !url.match(/youtube\.com|youtu\.be/)) {
    return res.status(400).json({ 
      success: false,
      error: 'URL YouTube invalide' 
    });
  }

  const filename = `${isPlaylist ? 'playlist' : 'audio'}_${Date.now()}${isPlaylist ? '.zip' : '.mp3'}`;
  const outputPath = path.join(TEMP_DIR, filename);

  try {
    const cmd = generateYtdlpCommand(url, outputPath, quality, isPlaylist);
    console.log(`Exécution: ${cmd}`);

    await new Promise((resolve, reject) => {
      const process = exec(cmd, { 
        timeout: 600000,
        cwd: TEMP_DIR
      });
      
      let output = '';
      process.stderr.on('data', (data) => {
        output += data.toString();
      });
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          console.log(output);
          resolve();
        } else {
          console.error('Erreur yt-dlp:', output);
          reject(new Error(`Échec du téléchargement (code ${code})`));
        }
      });
    });

    const stats = fs.statSync(outputPath);
    if (stats.size < 1024) {
      fs.unlinkSync(outputPath);
      throw new Error('Fichier trop petit (probablement corrompu)');
    }

    res.json({ 
      success: true,
      filename,
      filePath: `/temp/${filename}`,
      size: stats.size
    });

  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({ 
      success: false,
      error: 'Échec du téléchargement',
      details: err.message
    });
  }
});

// Servir les fichiers
app.get('/temp/:filename', (req, res) => {
  const filePath = path.join(TEMP_DIR, req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (!err) {
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (cleanErr) {
            console.error('Erreur nettoyage:', cleanErr);
          }
        }, 5000);
      }
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Fichier non trouvé'
    });
  }
});

// Nettoyage des fichiers temporaires
function cleanTempFiles() {
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      try {
        const filePath = path.join(TEMP_DIR, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Erreur suppression ${file}:`, err);
      }
    });
  });
}

// Route de santé
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    tempFiles: fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR).length : 0,
    uptime: process.uptime()
  });
});

// Démarrage
app.listen(PORT, () => {
  cleanTempFiles();
  console.log(`\n⚡ Serveur actif sur http://localhost:${PORT}`);
  console.log('✨ YouTube Downloader avec métadonnées');
  console.log('📌 Appuyez sur Ctrl+C pour arrêter\n');
});