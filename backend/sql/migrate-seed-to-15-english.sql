-- One-time migration from the original 50-product seed to 15 English products.
-- Run in a transaction after backing up products; then run resources/data.sql.
-- Existing IDs, prices, stock and images of retained products are preserved.
-- Not part of startup initialization: future product edits are preserved.
UPDATE products SET name = 'Ecuadorian Bananas', description = 'Sweet, high-quality bananas grown on the Ecuadorian coast.' WHERE name = 'Banano Ecuatoriano';
UPDATE products SET name = 'Nacional Fine Aroma Cocoa', description = 'Ecuadorian Nacional cocoa known for its floral aroma and distinctive flavor.' WHERE name = 'Cacao Nacional Fino de Aroma';
UPDATE products SET name = 'Loja Coffee', description = 'Arabica coffee grown in the mountains of Loja, with a smooth flavor and notes of chocolate and red berries.' WHERE name = 'Café de Loja';
UPDATE products SET name = 'Ecuadorian Roses', description = 'Long-stem roses grown in the Ecuadorian highlands, prized for their quality and vibrant colors.' WHERE name = 'Rosas de Ecuador';
UPDATE products SET name = 'Pacific White Shrimp', description = 'Premium white shrimp raised in coastal Ecuadorian ponds.' WHERE name = 'Camarón del Pacífico';
UPDATE products SET name = 'Yellow Dragon Fruit', description = 'Sweet, refreshing yellow dragon fruit grown in the Ecuadorian Amazon region.' WHERE name = 'Pitahaya Amarilla';
UPDATE products SET name = 'Goldenberries (Physalis)', description = 'Andean goldenberries with a distinctive sweet-tart flavor, rich in vitamins A and C.' WHERE name = 'Uvilla (Physalis)';
UPDATE products SET name = 'Quito Naranjilla', description = 'Tangy Andean fruit used in traditional Ecuadorian juices and desserts.' WHERE name = 'Naranjilla de Quito';
UPDATE products SET name = 'Ecuadorian Passion Fruit', description = 'Coastal passion fruit with a bright tropical flavor, ideal for juices, cocktails, and desserts.' WHERE name = 'Maracuyá Ecuatoriana';
UPDATE products SET name = 'Canned Hearts of Palm', description = 'Tender, mild hearts of palm grown in the Ecuadorian Amazon, ready to serve in salads.' WHERE name = 'Palmito en Conserva';
UPDATE products SET name = 'Pacari 70% Chocolate', description = 'Premium organic dark chocolate made with Ecuadorian fine aroma cocoa.' WHERE name = 'Chocolate Pacari 70%';
UPDATE products SET name = 'Republica del Cacao Chocolate', description = 'Artisan single-origin chocolate made with cocoa from the Ecuadorian coast.' WHERE name = 'Chocolate República del Cacao';
UPDATE products SET name = 'Canned Encebollado', description = 'Traditional Ecuadorian tuna soup with cassava and pickled onions, ready to heat and serve.' WHERE name = 'Encebollado Enlatado';
UPDATE products SET name = 'Green Plantain Chips', description = 'Crispy green plantain chips, a traditional snack from the Ecuadorian coast.' WHERE name = 'Chifles de Plátano Verde';
UPDATE products SET name = 'Canned Ecuadorian Tuna', description = 'Tuna caught in the Pacific Ocean off Ecuador and packed in olive oil.' WHERE name = 'Atún Ecuatoriano en Lata';
DELETE FROM products WHERE name IN (
    'Mermelada de Mora Andina',
    'Miel de Abeja de Vilcabamba',
    'Quinua Orgánica del Chimborazo',
    'Sal Prieta Manabita',
    'Ají Ecuatoriano en Frasco',
    'Agua Mineral Güitig',
    'Canelazo Artesanal',
    'Aguardiente Zhumir',
    'Cerveza Pilsener',
    'Colada Morada en Polvo',
    'Jugo de Guanábana',
    'Horchata Lojana',
    'Licor de Cacao',
    'Chicha de Jora',
    'Morocho Bebida',
    'Sombrero de Paja Toquilla',
    'Poncho de Otavalo',
    'Hamaca de Montecristi',
    'Tagua Tallada (Marfil Vegetal)',
    'Cerámica de Chordeleg',
    'Joyería de Filigrana de Chordeleg',
    'Bufanda de Alpaca Ecuatoriana',
    'Máscara de Diablo Huma',
    'Tapiz de Peguche',
    'Canasta de Mimbre de Cuenca',
    'Aceite Esencial de Palo Santo',
    'Palo Santo en Astillas',
    'Jabón de Cacao Orgánico',
    'Aceite de Rosa Mosqueta',
    'Ungurahua Aceite Capilar',
    'Crema de Manos de Cacao',
    'Shampoo de Romero Andino',
    'Té de Guayusa Amazónica',
    'Vela de Palo Santo',
    'Manteca de Cacao Pura'
);
