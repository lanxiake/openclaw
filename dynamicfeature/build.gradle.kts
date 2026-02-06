android {
    namespace = "com.example.dynamicfeature"

    defaultConfig {
      minSdk = 35
      testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
       release {
           isMinifyEnabled = false
           proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
       }
    }
    }

dependencies {
    implementation(project(":app"))
}