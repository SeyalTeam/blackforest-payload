process.env.DATABASE_URI = "mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal";
process.env.MONGODB_URI = "mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal";
process.env.PAYLOAD_DB_MODE = "mongo";
process.env.PAYLOAD_SECRET = "c44e148eee332356a3594a2d";
process.env.S3_ENDPOINT = "https://eb2c8ed12f807f300318e0757cb40221.r2.cloudflarestorage.com";
process.env.S3_ACCESS_KEY_ID = "f48b2bd4a43b206356a7ea87d453fca6";
process.env.S3_SECRET_ACCESS_KEY = "d07482a48fc4ebfd8685512604e51d80217961b530507c24e81c8f4c3119fac5";
process.env.S3_BUCKET = "vseyal";
process.env.S3_REGION = "auto";

async function run() {
  const { getPayload } = await import('payload');
  const configModule = await import('/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/payload.config');
  const config = configModule.default || configModule;

  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({
    slug: 'widget-settings',
    depth: 1
  })

  console.log('=== WIDGET SETTINGS ===')
  console.log(JSON.stringify(settings, null, 2))
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
