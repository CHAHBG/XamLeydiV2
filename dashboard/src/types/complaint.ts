export interface Complaint {
    id: string;
    parcel_number: string;
    date: string; // ISO string
    activity: string;
    commune: string;
    village: string;
    complainant_name: string;
    complainant_sex: 'M' | 'F' | null;
    complainant_id: string;
    complainant_contact: string;
    complaint_reason: string;
    complaint_category: 'sensible' | 'non_sensible';
    complaint_description: string;
    expected_resolution: string;
    complaint_reception_mode: string;
    created_at: string;
    complaint_function?: string;
    type_usage?: string;
    nature_parcelle?: string;
    source?: string;
    sent_remote?: boolean;
    data?: any;
    remote_response?: any;
}

export interface FilterOptions {
    startDate?: Date;
    endDate?: Date;
    commune?: string;
    village?: string;
    motif?: string;
    sex?: 'M' | 'F' | 'all';
    category?: 'sensible' | 'non_sensible' | 'all';
}
