import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { create } from "kubo-rpc-client";
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";

const wordArrayToUint8Array = (wordArray) => {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
  }
  return u8;
};

const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);
const propietarioContract = new ethers.Contract(
  addresses.ipfs,
  abis.ipfs,
  defaultProvider
);

function RecursosAccesoLicencia({ closeModal, selectedFile }) {
  const { tokenId, direccionPropietario, hash } = selectedFile;
  const [activeOption, setActiveOption] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [archivoDescifrado, setArchivoDescifrado] = useState(null);

  const functionalities = [
    { title: "Acceder al archivo", action: () => setActiveOption("acceso"), icon: <ArrowsRightLeftIcon className="w-8 h-8" /> },
  ];

  const accederArchivo = async (e) => {

    e.preventDefault()
    let archivo = "";
    let blobDescifrado = "";
    let claveDescifrada = "";
    let iv = "";
    let mimeType = "";
    let response = "";
    const signer = defaultProvider.getSigner();
    const userAddress = await signer.getAddress();
    const contratoConSigner = propietarioContract.connect(signer);

    try {
      // Obtenemos la clave de descifrado
      claveDescifrada = await contratoConSigner.obtenerClave(tokenId, userAddress);

      // Obtenemos el IV
      iv = await propietarioContract.obtenerIV(tokenId);

      response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`, {
        method: 'GET'
      });
      // Verificar que la respuesta sea exitosa
      if (!response.ok) {
        throw new Error('Error al obtener el archivo desde Piñata.');
      }

      // Convertir la respuesta a un Blob (contenido binario)
      archivo = await response.blob();
      console.log(archivo)

      // Obtenemos el mimeType
      mimeType = await contratoConSigner.obtenerTipoMime(direccionPropietario, tokenId);

      // Eliminar prefijos '0x' si existen
      const claveSinPrefijo = claveDescifrada.startsWith("0x") ? claveDescifrada.slice(2) : claveDescifrada;
      const ivSinPrefijo = iv.startsWith("0x") ? iv.slice(2) : iv;

      // Convertir clave e IV a WordArray
      const keyWordArray = CryptoJS.enc.Hex.parse(claveSinPrefijo);
      const ivWordArray = CryptoJS.enc.Hex.parse(ivSinPrefijo);

      // Convertir archivo cifrado (Buffer) a WordArray
      const archivoCifradoUint8Array = new Uint8Array(await archivo.arrayBuffer());
      const ciphertextWordArray = CryptoJS.lib.WordArray.create(archivoCifradoUint8Array);

      // Crear CipherParams para CryptoJS
      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertextWordArray });

      // Descifrar usando AES-CBC
      const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
        iv: ivWordArray,
        padding: CryptoJS.pad.Pkcs7, // Asegurarse de usar el mismo padding que en el cifrado
      });

      const decryptedBytes = wordArrayToUint8Array(decrypted)

      // Crear un Blob con el contenido descifrado y el tipo MIME
      blobDescifrado = new Blob([decryptedBytes], { type: mimeType });

    } catch (error) {
      console.error("Error en el proceso de descifrado", error.message);
      setErrorMessage("No se ha podido descifrar el archivo.");
      return null;
    }

    if (blobDescifrado) {
      setArchivoDescifrado(blobDescifrado);
    } else {
      setErrorMessage("Error al descifrar el archivo.");
    }
  }


  return (
    <div className="modal-container">
      <h2 className="text-2xl font-semibold">Opciones para acceder al archivo</h2>
      <div className="mt-6">
        {functionalities.map((func, idx) => (
          <button
            key={idx}
            onClick={func.action}
            className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
          >
            {func.title}
          </button>
        ))}
      </div>

      {activeOption === "acceso" && (
        <>
          <form onSubmit={accederArchivo}>
            <button
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
            >
              Acceder al Archivo
            </button>
            {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
          </form>
          {archivoDescifrado && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Vista Previa del Archivo</h3>
              <div className="mt-4 bg-gray-900 p-4 rounded shadow-md">
                {archivoDescifrado.type.startsWith("image/") && (
                  <img
                    src={URL.createObjectURL(archivoDescifrado)}
                    alt="Archivo Descifrado"
                    className="w-full rounded"
                  />
                )}
                {archivoDescifrado.type.startsWith("application/pdf") && (
                  <embed
                    src={URL.createObjectURL(archivoDescifrado)}
                    type="application/pdf"
                    className="w-full h-96 rounded"
                  />
                )}
                {!archivoDescifrado.type.startsWith("image/") &&
                  !archivoDescifrado.type.startsWith("application/pdf") && (
                    <iframe
                      src={URL.createObjectURL(archivoDescifrado)}
                      className="w-full h-96 rounded"
                      title="Archivo Descifrado"
                    ></iframe>
                  )}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={closeModal}
        className="bg-red-500 hover:bg-red-600 text-white mt-4 py-2 px-4 rounded w-full"
      >
        Cerrar
      </button>
    </div>
  );
}

export default RecursosAccesoLicencia;
