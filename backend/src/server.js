const app = require('./app');

// Dijalankan langsung (npm run dev / npm start) -> buka port.
// Di-import (Vercel serverless) -> cukup ekspor app.
if (require.main === module) {
  const PORT = Number(process.env.PORT || 5000);
  app.listen(PORT, () => {
    console.log(`🔥 FireeeMart API berjalan di http://localhost:${PORT}/api`);
  });
}

module.exports = app;
