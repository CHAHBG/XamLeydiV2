export interface Geometry {
  type: string;
  coordinates: number[][][];
}

export interface ParcelIndividuel {
  type: string;
  properties: {
    fid: number;
    Num_parcel: string;
    Typ_pers: string;
    Prenom?: string | null;
    Nom?: string | null;
    Denominat?: string | null;
    Mandataire?: string | null;
    Num_piece?: string | null;
    Parents?: string | null;
    Telephone?: string | null;
    Telephone_001?: string | null;
    Village?: string | null;
    // ...add other fields as needed
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

export interface ParcelCollectif {
  type: string;
  properties: {
    fid: number;
    Num_parcel: string;
    Prenom_M?: string | null;
    Nom_M?: string | null;
    Num_piec?: string | null;
    Parent?: string | null;
    Telephon2?: string | null;
    Village?: string | null;
    // ...add other fields as needed
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

export type Parcel = ParcelIndividuel | ParcelCollectif;

export interface SearchResult {
  parcel: Parcel;
  type: 'individuel' | 'collectif';
  matchField: string;
}