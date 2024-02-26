const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Fonksiyon: İlçe verilerini al ve veritabanına kaydet
async function saveDistrictsToDatabase(provinceName, districts) {
    try {
        // İlçe verilerini veritabanına kaydet
        const savedDistricts = await prisma.city.create({
            data: {
                name: provinceName,
                districts: {
                    createMany: {
                        data: districts.map(district => ({
                            name: district.name,
                            area: district.area,
                            population: district.population
                        }))
                    }
                }
            },
            include: {
                districts: true // İlçe verilerini döndür
            }
        });
    } catch (error) {
        console.error(`Error saving districts for ${provinceName}:`, error);
    }
}

// Fonksiyon: Tüm illerin verilerini al ve işle
async function fetchAllProvinces() {
    try {
        const response = await axios.get('https://turkiyeapi.dev/api/v1/provinces');
        const provinces = response.data.data;

        for (const province of provinces) {
            await saveDistrictsToDatabase(province.name, province.districts);
        }
    } catch (error) {
        console.error('Error fetching provinces:', error);
    }
}

// Ana programı çalıştır
async function main() {
    await fetchAllProvinces();
    await prisma.$disconnect(); // Prisma bağlantısını kapat
}

main();
