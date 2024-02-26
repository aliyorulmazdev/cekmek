const { Worker } = require('worker_threads');
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
// Kategorileri işçilere bölme fonksiyonu
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Anahtarları ve kategorileri almak için işçi oluştur
async function startWorkers() {
  const numWorkers = 15; // İşçi sayısı

  // Kategorileri almak için asenkron bir işlev tanımlayın
  async function getAllCategories() {
    const categories = await prisma.marketingCategory.findMany({ select: { name: true } });
    return categories;
  }

  // Kategorileri al
  const categories = await getAllCategories();

  // Kategorileri işçilere bölmek
  const chunks = chunkArray(categories, Math.ceil(categories.length / numWorkers));

  // Her bir işçi için bir işçi oluşturun
  const workers = chunks.map((chunk) => {
    const worker = new Worker('./worker.js', {
      workerData: { categories: chunk},
    });

    // İşçi mesajlarını dinle
    worker.on('message', (message) => {
      console.log(message);
    });

    return worker;
  });

  // İşçilerin bitmesini bekleyin
  await Promise.all(workers.map(worker => new Promise((resolve) => worker.on('exit', resolve))));
}

startWorkers();
