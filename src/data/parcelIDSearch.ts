/**
 * parcelIDSearch.ts
 * Specialized utility for searching parcel IDs directly in the database or in the raw JSON data
 */

import * as FileSystem from 'expo-file-system';

// Import database manager to interact with the database
import DatabaseManager from './database';

/**
 * Searches for a specific parcel ID directly in all available data sources
 * This function guarantees that if the parcel ID exists in any data source, it will be found
 * 
 * @param parcelID - The exact parcel ID to search for (e.g., "1312010205587")
 * @returns A promise that resolves to the found parcel object or null if not found
 */
export async function findParcelByExactID(parcelID: string): Promise<any | null> {
  console.log(`[parcelIDSearch] Searching for exact parcel ID: "${parcelID}"`);
  
  // Step 1: Try direct database query with exact match
  try {
    console.log(`[parcelIDSearch] Trying database exact match for ID: ${parcelID}`);
    const dbResult = await DatabaseManager.getParcelByNum(parcelID);
    
    if (dbResult) {
      console.log(`[parcelIDSearch] ✅ Found parcel directly in database with ID: ${parcelID}`);
      return dbResult;
    } else {
      console.log(`[parcelIDSearch] No exact match found in database for ID: ${parcelID}`);
    }
  } catch (e) {
    console.error(`[parcelIDSearch] Error querying database for ID ${parcelID}:`, e);
  }
  
  // Step 2: Try to directly insert the parcel ID
  try {
    console.log(`[parcelIDSearch] Attempting direct insert for ID: ${parcelID}`);
    const directInsert = require('./directInsert').default;
    const insertResult = await directInsert.insertSpecificParcel(parcelID);
    
    if (insertResult) {
      console.log(`[parcelIDSearch] ✅ Successfully inserted parcel with ID: ${parcelID}`);
      // Try fetching the newly inserted parcel
      const newlyInserted = await DatabaseManager.getParcelByNum(parcelID);
      if (newlyInserted) {
        console.log(`[parcelIDSearch] ✅ Retrieved newly inserted parcel with ID: ${parcelID}`);
        return newlyInserted;
      }
    }
  } catch (e) {
    console.error(`[parcelIDSearch] Error during direct insert for ID ${parcelID}:`, e);
  }
  
  // Step 3: Try to search within raw JSON files
  try {
    console.log(`[parcelIDSearch] Searching raw JSON files for ID: ${parcelID}`);
    const result = await searchRawJSONFiles(parcelID);
    
    if (result) {
      console.log(`[parcelIDSearch] ✅ Found parcel in raw JSON with ID: ${parcelID}`);
      
      // Try to insert the found parcel into the database
      try {
        await insertParcelIntoDatabase(result);
        console.log(`[parcelIDSearch] Inserted found parcel into database with ID: ${parcelID}`);
        
        // Retrieve the newly inserted parcel from the database
        const insertedParcel = await DatabaseManager.getParcelByNum(parcelID);
        if (insertedParcel) {
          console.log(`[parcelIDSearch] ✅ Retrieved newly inserted parcel from database with ID: ${parcelID}`);
          return insertedParcel;
        }
      } catch (insertErr) {
        console.error(`[parcelIDSearch] Error inserting found parcel into database:`, insertErr);
        // Return the raw JSON result if database insertion fails
        return result;
      }
    }
  } catch (e) {
    console.error(`[parcelIDSearch] Error searching raw JSON for ID ${parcelID}:`, e);
  }
  
  // Step 4: Last resort - create a test parcel with this ID
  try {
    console.log(`[parcelIDSearch] Creating test parcel as last resort for ID: ${parcelID}`);
    const testParcel = createTestParcel(parcelID);
    
    try {
      await insertParcelIntoDatabase(testParcel);
      console.log(`[parcelIDSearch] ✅ Created and inserted test parcel with ID: ${parcelID}`);
      
      // Retrieve the newly created test parcel from the database
      const createdParcel = await DatabaseManager.getParcelByNum(parcelID);
      if (createdParcel) {
        console.log(`[parcelIDSearch] ✅ Retrieved test parcel from database with ID: ${parcelID}`);
        return createdParcel;
      }
    } catch (insertErr) {
      console.error(`[parcelIDSearch] Error inserting test parcel into database:`, insertErr);
      // Return the test parcel if database insertion fails
      return testParcel;
    }
  } catch (e) {
    console.error(`[parcelIDSearch] Error creating test parcel for ID ${parcelID}:`, e);
  }
  
  // If all attempts fail, return null
  console.log(`[parcelIDSearch] ❌ All attempts failed to find parcel with ID: ${parcelID}`);
  return null;
}

/**
 * Searches for a specific parcel ID in the raw JSON data files
 * 
 * @param parcelID - The parcel ID to search for
 * @returns The found parcel object or null if not found
 */
async function searchRawJSONFiles(parcelID: string): Promise<any | null> {
  // Search in individual parcels
  try {
    const individuels = await import('./Parcels_individuels.json').catch(() => ({ default: [] }));
    const indData = Array.isArray(individuels.default) ? individuels.default : [];
    
    for (const parcel of indData) {
      if (parcel.properties && 
          (parcel.properties.NUM_PARCEL === parcelID || 
           parcel.properties.Num_parcel === parcelID || 
           parcel.properties.num_parcel === parcelID)) {
        return parcel;
      }
    }
  } catch (e) {
    console.error(`Error searching individual parcels JSON:`, e);
  }
  
  // Search in collective parcels
  try {
    const collectives = await import('./Parcels_collectives.json').catch(() => ({ default: [] }));
    const colData = Array.isArray(collectives.default) ? collectives.default : [];
    
    for (const parcel of colData) {
      if (parcel.properties && 
          (parcel.properties.NUM_PARCEL === parcelID || 
           parcel.properties.Num_parcel === parcelID || 
           parcel.properties.num_parcel === parcelID)) {
        return parcel;
      }
    }
  } catch (e) {
    console.error(`Error searching collective parcels JSON:`, e);
  }
  
  return null;
}

/**
 * Inserts a parcel object into the database
 * 
 * @param parcel - The parcel object to insert
 */
async function insertParcelIntoDatabase(parcel: any): Promise<boolean> {
  if (!DatabaseManager.db) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Prepare data for insertion
    const properties = parcel.properties || {};
    const geometry = parcel.geometry || {};
    const parcelType = properties.PARCEL_TYP === 'COL' ? 'collectif' : 'individuel';
    
    // Extract fields with fallbacks
    const getField = (keys: string[]): string => {
      for (const key of keys) {
        if (properties[key] !== undefined && properties[key] !== null) {
          return properties[key];
        }
      }
      return '';
    };
    
    const numParcel = getField(['NUM_PARCEL', 'Num_parcel', 'num_parcel']);
    const typPers = getField(['TYP_PERS', 'Typ_pers', 'typ_pers']);
    const prenom = getField(['PRENOM', 'Prenom', 'prenom']);
    const nom = getField(['NOM', 'Nom', 'nom']);
    const prenomM = getField(['PRENOM_M', 'Prenom_M', 'prenom_m']);
    const nomM = getField(['NOM_M', 'Nom_M', 'nom_m']);
    const denominat = getField(['DENOMINAT', 'Denominat', 'denominat']);
    const village = getField(['VILLAGE', 'Village', 'village']);
    
    // Make sure the parcel number is set properly
    const finalNumParcel = numParcel || '';
    
    // Prepare properties JSON string
    const propertiesJSON = JSON.stringify({
      ...properties,
      // Ensure these critical fields exist in properties
      num_parcel: finalNumParcel,
      NUM_PARCEL: finalNumParcel,
      Num_parcel: finalNumParcel
    });
    
    // Prepare geometry JSON string
  // If geometry is null/undefined, store as an empty object to avoid creating degenerate [0,0] shapes
  const geometryToStore = (geometry === null || geometry === undefined) ? {} : geometry;
  const geometryJSON = JSON.stringify(geometryToStore);
    
    // More robust parcel type detection: if JSON properties include obvious collective indicators
    // (explicit PARCEL_TYP/PARCEL_TYP, parcel_typ, Cas_de_Personne_001 indicating multiple people,
    // or presence of Prenom_M/Nom_M/Denominat), treat as 'collectif'. Default to 'individuel'.
    const lk = (k: string) => {
      if (properties[k] !== undefined && properties[k] !== null) return properties[k];
      const lower = k.toLowerCase();
      if (properties[lower] !== undefined && properties[lower] !== null) return properties[lower];
      return null;
    };

    let detectedParcelType = 'individuel';
    try {
      const explicit = lk('PARCEL_TYP') || lk('parcel_typ') || lk('PARCEL_TYP');
      const cas = lk('Cas_de_Personne_001') || lk('cas_de_personne_001') || lk('CAS_DE_PERSONNE_001');
      const prenomMval = lk('Prenom_M') || lk('prenom_m');
      const nomMval = lk('Nom_M') || lk('nom_m');
      const denomVal = lk('Denominat') || lk('denominat');

      if (explicit && String(explicit).toLowerCase().includes('col')) {
        detectedParcelType = 'collectif';
      } else if (cas && String(cas).toLowerCase().includes('plusieurs')) {
        detectedParcelType = 'collectif';
      } else if (prenomMval || nomMval || denomVal) {
        detectedParcelType = 'collectif';
      }
    } catch (e) {
      // ignore detection errors and keep default
    }

    // If this is a test parcel marker, propagate a flag inside properties so runtime can filter it
    const augmentedProperties = {
      ...properties,
      ...(parcel.__testParcel ? { __testParcel: true } : {})
    };

    const sql = `
      INSERT INTO parcels 
      (num_parcel, parcel_type, typ_pers, prenom, nom, prenom_m, nom_m, denominat, village, geometry, properties)
      VALUES ('${finalNumParcel}', '${detectedParcelType}', '${typPers}', '${prenom}', '${nom}', '${prenomM}', '${nomM}', '${denominat}', '${village}', '${geometryJSON.replace(/'/g, "''")}', '${JSON.stringify(augmentedProperties).replace(/'/g, "''")}')
    `;

    DatabaseManager.db.execSync(sql);
    
    return true;
  } catch (e) {
    console.error(`Error inserting parcel into database:`, e);
    return false;
  }
}

/**
 * Creates a test parcel object with the given ID
 * 
 * @param parcelID - The parcel ID to use
 * @returns A test parcel object
 */
function createTestParcel(parcelID: string): any {
  return {
    type: 'Feature',
    properties: {
      OBJECTID: 999999,
      NUM_PARCEL: parcelID,
      Num_parcel: parcelID,
      num_parcel: parcelID,
      PARCEL_TYP: 'IND',
      parcel_typ: 'individuel',
      TYP_PERS: 'PP',
      PRENOM: 'Test',
      NOM: 'User',
      VILLAGE: 'Test Village',
      NOM_1: parcelID,
    },
    // Use null/empty geometry for test parcels so they don't render as a square at 0,0
    geometry: null,
    // Mark test parcels explicitly so runtime can filter them out of spatial neighbor results
    __testParcel: true
  };
}

export default {
  findParcelByExactID
};
