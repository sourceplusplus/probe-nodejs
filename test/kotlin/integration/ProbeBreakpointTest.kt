package integration

import io.vertx.core.json.Json
import io.vertx.core.json.JsonObject
import io.vertx.junit5.VertxTestContext
import io.vertx.kotlin.coroutines.await
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import spp.protocol.SourceServices.Provide.toLiveInstrumentSubscriberAddress
import spp.protocol.instrument.LiveBreakpoint
import spp.protocol.instrument.LiveSourceLocation
import spp.protocol.instrument.event.LiveBreakpointHit
import spp.protocol.instrument.event.LiveInstrumentEvent
import spp.protocol.instrument.event.LiveInstrumentEventType
import java.util.concurrent.TimeUnit

class ProbeBreakpointTest : AbstractProbeIntegrationTest() {

    @Test
    fun testPrimitives() = runBlocking {
        val testContext = VertxTestContext()
        val consumer = vertx.eventBus().localConsumer<JsonObject>(toLiveInstrumentSubscriberAddress("system"))
        consumer.handler {
            testContext.verify {
                val event = Json.decodeValue(it.body().toString(), LiveInstrumentEvent::class.java)
                log.trace("Received event: $event")

                if (event.eventType == LiveInstrumentEventType.BREAKPOINT_HIT) {
//                    val item = Json.decodeValue(event.data, LiveBreakpointHit::class.java)
//                    val vars = item.stackTrace.first().variables
//                    assertEquals(9, vars.size)
                    // TODO
                    consumer.unregister()
                    testContext.completeNow()
                }
            }
        }

        assertNotNull(
            instrumentService.addLiveInstrument(
                LiveBreakpoint(
                    location = LiveSourceLocation("E2ETest.js", 11),
                    applyImmediately = true
                )
            ).await()
        )

        callVariableTests()
        if (testContext.awaitCompletion(60, TimeUnit.SECONDS)) {
            if (testContext.failed()) {
                throw RuntimeException(testContext.causeOfFailure())
            }
        } else {
            throw RuntimeException("Test timed out")
        }
    }

}