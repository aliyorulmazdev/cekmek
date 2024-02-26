const fs = require('fs');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function saveMarketingCategories() {
    try {
        // Excel dosyasını oku
        const workbook = xlsx.readFile('categories.xlsx');
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Satırları oku ve her bir satırı bir marketing kategorisi olarak kaydet
        const marketingCategories = [];
        for (const cellAddress in sheet) {
            if (cellAddress[0] === 'A' && parseInt(cellAddress.slice(1))) {
                const categoryName = sheet[cellAddress].v;
                marketingCategories.push({ name: categoryName });
            }
        }

        // Marketing kategorilerini veritabanına kaydet
        const savedCategories = await prisma.marketingCategory.createMany({
            data: marketingCategories,
        });

        console.log('Marketing categories saved successfully:', savedCategories);
    } catch (error) {
        console.error('Error saving marketing categories:', error);
    } finally {
        await prisma.$disconnect();
    }
}

saveMarketingCategories();
