plugins {
}

    android {
    namespace = "com.example.mylibrary"

    defaultConfig {
    minSdk = 35

      testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
      consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
       release {
           isMinifyEnabled = false
           proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
       }
    }
    }

  dependencies {
  }