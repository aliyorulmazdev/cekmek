const { isMainThread, workerData } = require("worker_threads");
const fetch = require("node-fetch");
const { PrismaClient } = require("@prisma/client");

// Prisma client oluştur
const prisma = new PrismaClient();

// Anahtar almak için işçi fonksiyonu
async function getNextApiKey() {
  // Tüm anahtarları al
  const apiKeys = await prisma.apiKey.findMany();
  // currentIndex'te bulunan anahtarı al
  let currentApiKeyIndex = workerData.apiKeyIndex || 0;
  const currentApiKey = apiKeys[currentApiKeyIndex];
  // Eğer remaining 0 ise veya negatif ise bir sonraki anahtara geç
  if (currentApiKey.remaining <= 0) {
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length; // Döngüyü sürdürmek için mod al
  }
  // Güncellenmiş anahtarı ve id'yi döndür
  return {
    key: apiKeys[currentApiKeyIndex].key,
    id: apiKeys[currentApiKeyIndex].id,
    apiKeyIndex: currentApiKeyIndex,
  };
}

// Google Places API'sine istek yapacak fonksiyon
async function searchPlacesInCity(cityName, district, category, page) {
  try {
    const { key, id } = await getNextApiKey(); // Sonraki API anahtarını ve id'sini al
    const requestBody = JSON.stringify({
      q: `${cityName} ${district} ${category}`,
      gl: "tr",
      hl: "tr",
      page: page,
    });

    const requestOptions = {
      method: "POST",
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json",
      },
      body: requestBody,
      redirect: "follow",
    };

    const response = await fetch(
      "https://google.serper.dev/places",
      requestOptions
    );

    if (response.status === 400) {
      // HTTP 400 hatası aldığınızda mevcut API anahtarını sil
      console.error(
        "HTTP 400 hatası alındı. Mevcut API anahtarı siliniyor."
      );
      await prisma.apiKey.delete({
        where: { id: id }, // Mevcut API anahtarını sil
      });
      return null; // Null döndürerek işlemi sonlandır
    }

    const result = await response.json();

    // API çağrısı yapıldıktan sonra remaining değerini azalt
    // API anahtarını güncelle
    await prisma.apiKey.update({
      where: { id: id }, // Burada id'yi kullanarak güncelleme yap
      data: { remaining: { decrement: 1 } }, // Remaining değerini azalt
    });

    return result;
  } catch (error) {
    console.error("Error in searchPlacesInCity:", error);
    throw error; // Hatanın üst seviyeye fırlatılması
  }
}

// Verilen kategori adıyla ilgili MarketingCategory'yi veritabanından bulacak fonksiyon
async function getMarketingCategoryByName(categoryName) {
  const marketingCategory = await prisma.marketingCategory.findFirst({
    where: {
      name: categoryName,
    },
  });
  return marketingCategory;
}

// Şehir adıyla ilgili şehri veritabanından bulacak fonksiyon
async function getCityByName(cityName) {
  const city = await prisma.city.findFirst({
    where: {
      name: cityName,
    },
  });
  return city;
}

// Yerleri arayacak ve kaydedecek fonksiyon
// Yerleri arayacak ve kaydedecek fonksiyon
async function searchAndSavePlaces(cityName, category, done) {
  try {
    const city = await getCityByName(cityName);

    if (!city) {
      console.error(`Belirtilen isimde bir şehir bulunamadı: ${cityName}`);
      return;
    }

    const marketingCategory = await getMarketingCategoryByName(category);

    if (!marketingCategory) {
      console.error(
        `Belirtilen kategori adında bir MarketingCategory bulunamadı: ${category}`
      );
      return;
    }

    const districts = await prisma.district.findMany({
      where: {
        cityId: city.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    let page = 1;
    let hasNextPage = true;

    for (const district of districts) {
      const currentDistrict = district; // Mevcut ilçeyi temsil eden değişkeni tanımla
      while (hasNextPage) {
        const searchResult = await searchPlacesInCity(cityName, currentDistrict.name, category, page);
      
        if (searchResult.places.length === 0) {
          hasNextPage = false;
          continue;
        }
      
        const placesToSave = []; // Kaydedilecek yerleri tutmak için bir dizi oluştur
      
        const existingCids = new Set(); // Mevcut cid değerlerini tutmak için bir küme oluştur
        console.log("Current district:", currentDistrict);
    
        for (const place of searchResult.places) {
          const cityId = city.id; // Şehir ID'sini al
          if (
            place.cid !== undefined &&
            place.cid !== null &&
            place.cid.trim() !== "" &&
            !existingCids.has(place.cid)
          ) {
            const data = {
              position: place.position || 0,
              title: place.title || "Bilinmeyen Yer",
              address: place.address || "Bilinmeyen Adres",
              latitude: place.latitude || 0,
              longitude: place.longitude || 0,
              thumbnailUrl: place.thumbnailUrl || "",
              rating: place.rating || 0,
              ratingCount: place.ratingCount || 0,
              category: marketingCategory.name,
              phoneNumber: place.phoneNumber || "Bilinmeyen Telefon",
              website: place.website || "",
              cid: place.cid,
              cityId: cityId,
              districtId: currentDistrict.id
            };
        
            placesToSave.push(data);
            existingCids.add(place.cid);
          }
        }
    
        if (placesToSave.length > 0) {
          // Veritabanında aynı `cid` değerine sahip kayıtları kontrol et
          const existingCompanies = await prisma.company.findMany({
            where: {
              cid: { in: placesToSave.map((place) => place.cid) },
            },
            select: { cid: true },
          });
    
          const existingCidsSet = new Set(
            existingCompanies.map((company) => company.cid)
          );
    
          // Yalnızca veritabanında olmayan kayıtları ekleyin
          const companiesToSave = placesToSave.filter(
            (place) => !existingCidsSet.has(place.cid)
          );
    
          if (companiesToSave.length > 0) {
            await prisma.company.createMany({
              data: companiesToSave,
            });
          }
        }
    
        page++;
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    done(); // İşlem tamamlandığında done fonksiyonunu çağır
  }
}


// Ana program
async function main() {
  const cityName = "İzmir"; // Aramak istediğiniz şehrin adını burada belirtin
  const categories = workerData.categories;

  let count = 0;

  const done = () => {
    count++;
    if (count === categories.length) {
      prisma.$disconnect(); // Tüm kategoriler tamamlandığında bağlantıyı kapat
    }
  };

  for (const category of categories) {
    await searchAndSavePlaces(cityName, category.name, done);
  }
}

// Ana iş parçacığı veya ana işçi olup olmadığını kontrol edin
if (!isMainThread) {
  // İşçi işlevini çağırın
  main();
}
