import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const disputaContract = new ethers.Contract(
    addresses.ipfs, // Dirección del contrato
    abis.ipfs,      // ABI del contrato
    defaultProvider
);

function VisualizarDisputas({ closeModal }) {
    const [tokenId, setTokenId] = useState("");
    const [disputas, setDisputas] = useState([]);
    const [isFetching, setIsFetching] = useState(false);

    // Obtener las disputas para un tokenId
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!tokenId) {
            toast.error("Por favor, introduce un tokenId válido.");
            return;
        }

        setIsFetching(true);

        try {
            const signer = defaultProvider.getSigner();
            const contratoConSigner = disputaContract.connect(signer);

            // Llamada al contrato para obtener las disputas
            const result = await contratoConSigner.verDisputas(tokenId);
            console.log("Disputas devueltas:", result);

            // Verifica si no hay disputas
            if (!result || result.length === 0) {
                toast.info(`No se encontraron disputas para el token ${tokenId}.`);
                setDisputas([]);
                return;
            }

            // Formatear las disputas (si es necesario, según cómo las devuelve el contrato)
            const formattedDisputas = result.map((disputa) => ({
                denunciante: disputa.denunciante || disputa[0],
                motivo: disputa.motivo || disputa[1],
                fecha: Number(disputa.fecha || disputa[2]),
            }));

            setDisputas(formattedDisputas);
        } catch (error) {
            console.error("Error al obtener las disputas:", error.message);
            toast.error("Hubo un problema al procesar tu solicitud.");
        } finally {
            setIsFetching(false);
        }
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-blue-gray-900 text-white rounded-lg shadow-lg p-8 w-[800px] relative flex">
                {/* Botón para cerrar */}
                <button
                    onClick={closeModal}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
                >
                    &times;
                </button>

                {/* Columna izquierda: Formulario */}
                <div className="w-1/2 pr-4">
                    <h2 className="text-2xl font-light mb-4">Ver Disputas</h2>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="number"
                            placeholder="Token ID"
                            value={tokenId}
                            onChange={(e) => setTokenId(e.target.value)}
                            className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
                            required
                        />
                        <button
                            type="submit"
                            className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
                        >
                            {isFetching ? "Buscando..." : "Ver Disputas"}
                        </button>
                    </form>

                    {disputas.length === 0 && !isFetching && (
                        <p className="mt-4 text-gray-400">No hay disputas para mostrar.</p>
                    )}
                </div>

                {/* Columna derecha: Lista de disputas */}
                <div className="w-1/2 pl-4 border-l border-gray-700">
                    {disputas.length > 0 && (
                        <>
                            <h3 className="text-lg font-semibold">Disputas Encontradas:</h3>
                            <ul className="mt-2 space-y-2">
                                {disputas.map((disputa, index) => (
                                    <li key={index} className="bg-gray-700 p-3 rounded text-sm">
                                        <p><strong>Denunciante:</strong> {disputa.denunciante}</p>
                                        <p><strong>Motivo:</strong> {disputa.motivo}</p>
                                        <p>
                                            <strong>Fecha:</strong> {new Date(disputa.fecha * 1000).toLocaleString()}
                                        </p>
                                        <div className="address-container">
                                            <strong>Dirección:</strong> {disputa.denunciante}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

}

export default VisualizarDisputas;

