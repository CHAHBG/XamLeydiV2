// Direct insert utility for specific parcel numbers
import DatabaseManager from './database';

/**
 * Directly inserts a parcel with the given ID into the database.
 * This is a utility function to help with testing the search functionality.
 */
export async function insertSpecificParcel(parcelId: string): Promise<boolean> {
  console.log(`Directly inserting parcel with ID: ${parcelId}`);
  
  try {
    const db = (DatabaseManager as any).db;
    if (!db) {
      console.error("Database not initialized");
      return false;
    }
    
    // Check if the parcel already exists
    const existing = db.execSync(
      "SELECT * FROM parcels WHERE num_parcel = ?", 
      [parcelId]
    );
    
    if (existing) {
      console.log(`Parcel ${parcelId} already exists in the database`);
      return true;
    }
    
    // Create a simple parcel record
    const insertQuery = `
      INSERT INTO parcels (
        num_parcel, parcel_type, typ_pers, prenom, nom, 
        prenom_m, nom_m, denominat, village, geometry, properties
      ) VALUES (
        ?, 'collectif', 'Plusieurs_Personne_Physique', NULL, NULL, 
        'Représentant', 'Collectif', 'Collective de Test', 'Test Village', 
        '{}', ?
      )
    `;
    
    // Create properties JSON that explicitly includes the parcel ID to ensure it's searchable
    const propertiesJson = JSON.stringify({
      Num_parcel: parcelId,
      grappeSenegal: "TEST",
      regionSenegal: "TEST REGION",
      departmentSenegal: "TEST DEPARTMENT",
      communeSenegal: "TEST COMMUNE",
      Village: "Test Village",
      Cas_de_Personne_001: "Plusieurs_Personne_Physique",
      Quel_est_le_nombre_d_affectata: "3",
      searchId: parcelId // Extra field for searching
    });
    
    // Execute the insert
    db.execSync(insertQuery, [parcelId, propertiesJson]);
    
    // Verify the insertion
    const verification = db.execSync(
      "SELECT * FROM parcels WHERE num_parcel = ?", 
      [parcelId]
    );
    
    if (verification) {
      console.log(`Successfully inserted and verified parcel ${parcelId}`);
      return true;
    } else {
      console.error(`Failed to verify insertion of parcel ${parcelId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error directly inserting parcel ${parcelId}:`, error);
    return false;
  }
}

export default {
  insertSpecificParcel
};
