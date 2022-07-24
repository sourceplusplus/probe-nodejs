package integration/*
 * Source++, the open-source live coding platform.
 * Copyright (C) 2022 CodeBrig, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import io.vertx.core.Vertx
import io.vertx.core.json.JsonObject
import io.vertx.core.net.NetClientOptions
import io.vertx.core.net.NetSocket
import io.vertx.ext.bridge.BridgeEventType
import io.vertx.ext.eventbus.bridge.tcp.impl.protocol.FrameHelper
import io.vertx.ext.eventbus.bridge.tcp.impl.protocol.FrameParser
import io.vertx.ext.web.client.WebClient
import io.vertx.junit5.VertxExtension
import io.vertx.kotlin.coroutines.await
import io.vertx.serviceproxy.ServiceProxyBuilder
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.extension.ExtendWith
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import spp.protocol.SourceServices
import spp.protocol.SourceServices.Provide.toLiveInstrumentSubscriberAddress
import spp.protocol.extend.TCPServiceFrameParser
import spp.protocol.service.LiveInstrumentService
import java.io.IOException
import java.util.*

@ExtendWith(VertxExtension::class)
abstract class AbstractProbeIntegrationTest {

    companion object {

        val log: Logger = LoggerFactory.getLogger(AbstractProbeIntegrationTest::class.java)
        const val SYSTEM_JWT_TOKEN =
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkZXZlbG9wZXJfaWQiOiJzeXN0ZW0iLCJjcmVhdGVkX2F0IjoxNjIyNDIxMzY0ODY4" +
                    "LCJleHBpcmVzX2F0IjoxNjUzOTU3MzY0ODY4LCJpYXQiOjE2MjI0MjEzNjR9.ZVHtxQkfCF7KM_dyDOgawbwpEAsmnCWB4c8I" +
                    "52svPvVc-SlzkEe0SYrNufNPniYZeM3IF0Gbojl_DSk2KleAz9CLRO3zfegciXKeEEvGjsNOqfQjgU5yZtBWmTimVXq5QoZME" +
                    "GuAojACaf-m4J0H7o4LQNGwrDVA-noXVE0Eu84A5HxkjrRuFlQWv3fzqSRC_-lI0zRKuFGD-JkIfJ9b_wP_OjBWT6nmqkZn_J" +
                    "mK7UwniTUJjocszSA2Ma3XLx2xVPzBcz00QWyjhIyiftxNQzgqLl1XDVkRtzXUIrHnFCR8BcgR_PsqTBn5nH7aCp16zgmkkbO" +
                    "pmJXlNpDSVz9zUY4NOrB1jTzDB190COrfCXddb7JO6fmpet9_Zd3kInJx4XsT3x7JfBSWr9FBqFoUmNkgIWjkbN1TpwMyizXA" +
                    "Sp1nOmwJ64FDIbSpfpgUAqfSWXKZYhSisfnBLEyHCjMSPzVmDh949w-W1wU9q5nGFtrx6PTOxK_WKOiWU8_oeTjL0pD8pKXqJ" +
                    "MaLW-OIzfrl3kzQNuF80YT-nxmNtp5PrcxehprlPmqSB_dyTHccsO3l63d8y9hiIzfRUgUjTJbktFn5t41ADARMs_0WMpIGZJ" +
                    "yxcVssstt4J1Gj8WUFOdqPsIKigJZMn3yshC5S-KY-7S0dVd0VXgvpPqmpb9Q9Uho"

        lateinit var vertx: Vertx
        lateinit var instrumentService: LiveInstrumentService

        @BeforeAll
        @JvmStatic
        fun setup() = runBlocking {
            vertx = Vertx.vertx()

            val socket = setupTcp(vertx)
            socket.handler(FrameParser(TCPServiceFrameParser(vertx, socket)))
            setupHandler(socket, vertx, SourceServices.Utilize.LIVE_INSTRUMENT)

            FrameHelper.sendFrame(
                BridgeEventType.REGISTER.name.lowercase(),
                toLiveInstrumentSubscriberAddress("system"), null,
                JsonObject().put("auth-token", SYSTEM_JWT_TOKEN), null, null, socket
            )

            instrumentService = ServiceProxyBuilder(vertx)
                .setToken(SYSTEM_JWT_TOKEN)
                .setAddress(SourceServices.Utilize.LIVE_INSTRUMENT)
                .build(LiveInstrumentService::class.java)
        }

        @AfterAll
        @JvmStatic
        fun tearDown() {
            runBlocking {
                vertx.close().await()
            }
        }

        fun setupHandler(socket: NetSocket, vertx: Vertx, address: String) {
            vertx.eventBus().localConsumer<JsonObject>(address) { resp ->
                val replyAddress = UUID.randomUUID().toString()
                val tempConsumer = vertx.eventBus().localConsumer<Any>(replyAddress)
                tempConsumer.handler {
                    resp.reply(it.body())
                    tempConsumer.unregister()
                }

                val headers = JsonObject()
                resp.headers().entries().forEach { headers.put(it.key, it.value) }
                FrameHelper.sendFrame(
                    BridgeEventType.SEND.name.lowercase(),
                    address, replyAddress, headers, true, resp.body(), socket
                )
            }
        }

        private suspend fun setupTcp(vertx: Vertx): NetSocket {
            val serviceHost = if (System.getenv("SPP_PLATFORM_HOST") != null)
                System.getenv("SPP_PLATFORM_HOST") else "localhost"
            val options = NetClientOptions()
                .setReconnectAttempts(Int.MAX_VALUE).setReconnectInterval(5000)
                .setSsl(true)
                .setTrustAll(true)
            val tcpSocket = withTimeout(5000) {
                vertx.createNetClient(options).connect(5455, serviceHost).await()
            }
            return tcpSocket
        }

        suspend fun callVariableTests() {
            val e2eAppHost = if (System.getenv("E2E_APP_HOST") != null)
                System.getenv("E2E_APP_HOST") else "localhost"
            log.trace("E2E_APP_HOST: $e2eAppHost")

            try {
                val statusCode = WebClient.create(vertx).get(4000, e2eAppHost, "/").send().await().statusCode()
                log.trace("Status code: $statusCode")
                assertEquals(200, statusCode)
            } catch (_: IOException) {
            }
        }
    }
}