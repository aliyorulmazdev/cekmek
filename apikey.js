const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Kullanıcıdan API anahtarını al
    rl.question('Lütfen API anahtarını girin: ', async (apiKey) => {
        try {
            // API anahtarını veritabanına kaydet
            const createdApiKey = await prisma.apiKey.create({
                data: {
                    key: apiKey
                }
            });
            console.log('API anahtarı başarıyla kaydedildi:');
            console.log(createdApiKey);

            // Veritabanı bağlantısını kapat
            await prisma.$disconnect();
        } catch (error) {
            console.error('API anahtarı kaydedilirken bir hata oluştu:', error);
        } finally {
            // readline arayüzünü kapat
            rl.close();
        }
    });
}

// Ana programı çalıştır
main();
