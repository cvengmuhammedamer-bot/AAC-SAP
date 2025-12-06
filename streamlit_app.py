import streamlit as st
from google import genai

# يجب وضع مفتاح API في ملف .streamlit/secrets.toml للنشر الآمن
# أو استخدام st.secrets
client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])

st.title("El Beltagy")
prompt = st.text_input(":")

if prompt:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    st.write(response.text)
