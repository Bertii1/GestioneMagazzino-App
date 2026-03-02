// Eseguito da MongoDB al primo avvio del container
// Crea il database e un utente dedicato all'app
db = db.getSiblingDB('gestione_magazzino');

db.createCollection('users');
db.createCollection('warehouses');
db.createCollection('shelves');
db.createCollection('products');

print('Database gestione_magazzino inizializzato.');
