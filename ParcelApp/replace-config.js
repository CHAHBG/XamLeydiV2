module.exports = {
  files: "src/screens/ParcelDetailScreen.tsx",
  from: [
    "<Divider style={styles.divider} />",
    "<View style={styles.divider} />"
  ],
  to: [
    "<View style={{ height: 1, backgroundColor: \"#e0e0e0\", marginVertical: 12 }} />",
    "<View style={{ height: 1, backgroundColor: \"#e0e0e0\", marginVertical: 12 }} />"
  ]
};
