const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Parcels_collectives.json');
const backupPath = filePath + '.bak.' + Date.now();

const keysToRemove = [
  "start_IND",
  "today_IND",
  "grappeSenegal_IND",
  "regionSenegal_IND",
  "departmentSenegal_IND",
  "arrondissementSenegal_IND",
  "communeSenegal_IND",
  "Village_IND",
  "Date_enqet_IND",
  "OF_ou_Gpmt_IND",
  "Enqueter_IND",
  "Typ_pers_IND",
  "Prenom_IND",
  "Nom_IND",
  "Sexe_IND",
  "Situa_mat_IND",
  "Nbr_epse_IND",
  "Chef_famil_IND",
  "Chef_menag_IND",
  "maj_homme_IND",
  "maj_femme_IND",
  "min_homme_IND",
  "min_femme_IND",
  "pers_en_charge_IND",
  "Nat_IND",
  "Autres_nat_IND",
  "Date_naiss_IND",
  "Lieu_naiss_IND",
  "Type_piece_IND",
  "Num_piece_IND",
  "Date_deliv_IND",
  "Parents_IND",
  "Photo_rec_IND",
  "Photo_rec_URL_IND",
  "Photo_ver_IND",
  "Photo_ver_URL_IND",
  "Lieu_resid_IND",
  "Telephone_IND",
  "Email_IND",
  "Typ_pers_m_IND",
  "Denominat_IND",
  "Creation_IND",
  "Siege_IND",
  "Type_num_IND",
  "Autre_pr_ciser_IND",
  "Numero_IND",
  "PhotoPieMo_IND",
  "PhotoPieMo_URL_IND",
  "Mandataire_IND",
  "Telephone_001_IND",
  "Adresse_IND",
  "Email_001_IND",
  "Acteur_fon_IND",
  "Autre_AF_IND",
  "Outils_fon_IND",
  "Repondant_IND",
  "Autre_Rep_IND",
  "Nom_exploi_IND",
  "Prenom_expl_IND",
  "Num_Tel_IND",
  "Nicad_IND",
  "Vocation_IND",
  "Occup_nord_IND",
  "Occup_sud_IND",
  "Occup_est_IND",
  "Occup_ouest_IND",
  "type_usag_IND",
  "Equip_parc_IND",
  "Autre_eqpt_IND",
  "Syst_cultu_IND",
  "Aut_sysCul_IND",
  "Type_cult_001_IND",
  "Aut_typcul_IND",
  "Source_ali_IND",
  "Aut_SrcAli_IND",
  "Irrigation_IND",
  "Sup_declar_IND",
  "Sup_exploi_IND",
  "Sup_reelle_IND",
  "Sup_affect_IND",
  "Coord_X_IND",
  "Coord_Y_IND",
  "Mode_acces_IND",
  "Type_doc_IND",
  "Deliv_recu_IND",
  "Num_decise_IND",
  "Date_decise_IND",
  "Aut_or_dec_IND",
  "Num_appro_IND",
  "Date_appro_IND",
  "Aut_or_app_IND",
  "Acc_M_cout_IND",
  "Mode_coutum_IND",
  "Dat_trans1_IND",
  "Autr_MdCTM_IND",
  "Aut_ModCou_IND",
  "Dat_trans2_IND",
  "Conflit_f_IND",
  "Cause_conf_IND",
  "Comnt_Conf_IND",
  "Date_conf_IND",
  "Prota_conf_IND",
  "Resol_conf_IND",
  "Int_re_conf_IND",
  "Frais_born_IND",
  "Install_IND",
  "Dat_instal_IND",
  "Obs_parc_IND",
  "Centro_de_IND",
  "_Centro_de_latitude_IND",
  "_Centro_de_longitude_IND",
  "_Centro_de_altitude_IND",
  "_Centro_de_precision_IND",
  "Photo_Doc_IND",
  "Photo_Doc_URL_IND",
  "Photo_Doc_1_IND",
  "Photo_Doc_1_URL_IND",
  "Photo_Doc_2_IND",
  "Photo_Doc_2_URL_IND",
  "Photo_Doc_3_IND",
  "Photo_Doc_3_URL_IND",
  "Photo_Doc_4_IND",
  "Photo_Doc_4_URL_IND",
  "Photo_Doc_5_IND",
  "Photo_Doc_5_URL_IND",
  "_id_IND",
  "_uuid_IND",
  "_validation_status_IND"
];

function clean() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse JSON:', err.message);
    process.exit(1);
  }

  // Backup original
  fs.writeFileSync(backupPath, raw, 'utf8');
  console.log('Backup written to', backupPath);

  let removedCount = 0;
  // data is expected to be an array
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object' && item.properties && typeof item.properties === 'object') {
        for (const key of keysToRemove) {
          if (Object.prototype.hasOwnProperty.call(item.properties, key)) {
            delete item.properties[key];
            removedCount++;
          }
        }
      }
    }
  } else if (data && typeof data === 'object' && data.features && Array.isArray(data.features)) {
    for (const item of data.features) {
      if (item && typeof item === 'object' && item.properties && typeof item.properties === 'object') {
        for (const key of keysToRemove) {
          if (Object.prototype.hasOwnProperty.call(item.properties, key)) {
            delete item.properties[key];
            removedCount++;
          }
        }
      }
    }
  } else {
    console.error('Unexpected JSON structure: expected array or { features: [] }');
    process.exit(1);
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated file written:', filePath);
  console.log('Total keys removed:', removedCount);
}

clean();
