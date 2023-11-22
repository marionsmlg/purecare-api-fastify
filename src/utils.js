export async function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString(); // convert Buffer to string
    });
    request.on("error", (err) => {
      reject(err);
    });
    request.on("end", () => {
      resolve(body);
    });
  });
}

export function convertFormDataToJSON(formData) {
  return Object.fromEntries(new URLSearchParams(formData));
}
