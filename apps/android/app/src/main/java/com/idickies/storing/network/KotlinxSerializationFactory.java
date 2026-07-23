package com.idickies.storing.network;

import okhttp3.MediaType;
import kotlinx.serialization.json.Json;
import retrofit2.Converter;
import retrofit2.converter.kotlinx.serialization.KotlinSerializationConverterFactory;

/** Java bridge exposes Retrofit's Kotlin-internal factory without switching the app away from kotlinx.serialization. */
public final class KotlinxSerializationFactory {
  private KotlinxSerializationFactory() {}

  public static Converter.Factory create(Json json) {
    return KotlinSerializationConverterFactory.create(json, MediaType.get("application/json"));
  }
}
